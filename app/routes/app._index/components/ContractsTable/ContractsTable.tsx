import {
  createElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {useNavigate} from '@remix-run/react';
import {parseGid} from '@shopify/admin-graphql-api-utilities';
import {
  BlockStack,
  Box,
  Button,
  Divider,
  EmptySearchResult,
  IndexFilters,
  InlineStack,
  Text,
  type SelectionType,
} from '~/components/polaris';
import {useTranslation} from 'react-i18next';
import {StatusBadge} from '~/components';
import {useDeliveryFrequencyFormatter, useProductCountFormatter} from '~/hooks';
import {
  SubscriptionContractStatus,
  type SubscriptionContractListItem,
} from '~/types/contracts';
import {useFormatDate} from '~/utils/helpers/date';
import {formatStatus, hasInventoryError} from '~/utils/helpers/contracts';
import {formatPrice} from '~/utils/helpers/money';
import {useContractListState} from '../../hooks/useContractListState';
import {BulkActionModal} from './components/PauseBulkActionModal/BulkActionModal';
import {InventoryErrorPopover} from './components/InventoryErrorPopover/InventoryErrorPopover';
import styles from './ContractsTable.module.css';

const IS_TEST_ENV = process.env.NODE_ENV === 'test';

type SelectionCheckboxProps = {
  id: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

function SelectionCheckbox({
  id,
  checked,
  label,
  onChange,
}: SelectionCheckboxProps) {
  const handleChange = (event: any) => {
    const nextChecked = Boolean(
      event?.currentTarget?.checked ?? event?.target?.checked ?? !checked,
    );
    onChange(nextChecked);
  };

  if (IS_TEST_ENV) {
    return (
      <input
        id={id}
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={handleChange}
      />
    );
  }

  return createElement('s-checkbox' as any, {
    id,
    checked,
    accessibilityLabel: label,
    'aria-label': label,
    onChange: handleChange,
    onClick: (event: Event) => event.stopPropagation(),
  });
}

function TableHeader({
  title,
  hidden,
  format,
  listSlot,
}: {
  title: string;
  hidden?: boolean;
  format?: 'numeric';
  listSlot?: 'primary' | 'secondary';
}) {
  return createElement(
    's-table-header' as any,
    {
      role: 'columnheader',
      accessibilityVisibility: hidden ? 'exclusive' : undefined,
      format,
      listSlot,
    },
    title,
  );
}

function TableCell({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (event: any) => void;
}) {
  return createElement(
    's-table-cell' as any,
    {
      role: 'cell',
      className,
      onClick,
    },
    children,
  );
}

export interface ContractsTableProps {
  contracts: SubscriptionContractListItem[];
  hasContractsWithInventoryError: boolean;
  selectedResources: string[];
  allResourcesSelected: boolean;
  clearSelection: () => void;
  handleSelectionChange: (
    selectionType: SelectionType,
    isSelecting: boolean,
    selection?: string | [number, number],
  ) => void;
}

export function ContractsTable({
  contracts,
  hasContractsWithInventoryError,
  selectedResources,
  allResourcesSelected,
  clearSelection,
  handleSelectionChange,
}: ContractsTableProps) {
  const {t, i18n} = useTranslation('app.contracts');
  const locale = i18n.language;
  const navigate = useNavigate();
  const productCountFormatter = useProductCountFormatter();
  const {deliveryFrequencyText} = useDeliveryFrequencyFormatter();
  const formatDate = useFormatDate();
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrame = requestAnimationFrame(() => {
      setLayoutVersion((currentVersion) => currentVersion + 1);
    });

    if (typeof ResizeObserver === 'undefined' || !containerRef.current) {
      return () => cancelAnimationFrame(animationFrame);
    }

    let previousWidth = containerRef.current.getBoundingClientRect().width;
    const resizeObserver = new ResizeObserver(([entry]) => {
      const nextWidth = entry.contentRect.width;

      if (nextWidth <= 0 || nextWidth === previousWidth) return;

      previousWidth = nextWidth;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        setLayoutVersion((currentVersion) => currentVersion + 1);
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, []);

  const closePauseModal = useCallback(() => {
    setPauseModalOpen(false);
    clearSelection();
  }, [clearSelection]);

  const closeActivateModal = useCallback(() => {
    setActivateModalOpen(false);
    clearSelection();
  }, [clearSelection]);

  const closeCancelModal = useCallback(() => {
    setCancelModalOpen(false);
    clearSelection();
  }, [clearSelection]);

  const {
    selectedTab,
    selectedTabKey,
    handleTabSelect,
    tabs,
    listLoading,
    onSort,
    sortOptions,
    sortSelected,
  } = useContractListState(hasContractsWithInventoryError);

  let pausable = false;
  let resumable = false;
  let cancellable = false;

  selectedResources.forEach((contractId) => {
    const contract = contracts.find((currentContract) => currentContract.id === contractId);

    if (!contract || contract.status === SubscriptionContractStatus.Cancelled) {
      return;
    }

    cancellable = true;

    if (contract.status !== SubscriptionContractStatus.Paused) {
      pausable = true;
    }

    if (contract.status === SubscriptionContractStatus.Paused) {
      resumable = true;
    }
  });

  const bulkActions = [
    {
      content: t('table.bulkActions.pause', {
        count: selectedResources.length,
      }),
      onAction: () => setPauseModalOpen(true),
      disabled: !pausable,
    },
    {
      content: t('table.bulkActions.activate', {
        count: selectedResources.length,
      }),
      onAction: () => setActivateModalOpen(true),
      disabled: !resumable,
    },
    {
      content: t('table.bulkActions.cancel', {
        count: selectedResources.length,
      }),
      onAction: () => setCancelModalOpen(true),
      disabled: !cancellable,
    },
  ];

  const emptyStateMarkup = (
    <EmptySearchResult
      title={t('table.emptyState.title')}
      description={t('table.emptyState.description', {
        status: t(`table.tabs.${selectedTabKey}`),
      })}
      withIllustration
    />
  );

  const shouldShowWarningColumn = hasContractsWithInventoryError;

  const contractRowsMarkup = contracts.map((contract) => {
    const contractId = parseGid(contract.id);
    const selectionLabel = t('table.resourceName.singular', {
      defaultValue: 'Contract',
    });

    return createElement(
      's-table-row' as any,
      {
        key: contract.id,
        role: 'row',
        onClick: () => navigate(`/app/contracts/${contractId}`),
        style: {cursor: 'pointer'},
      },
      TableCell({
        onClick: (event) => event.stopPropagation(),
        children: (
          <SelectionCheckbox
            id={`contract-selection-${contractId}`}
            checked={selectedResources.includes(contract.id)}
            label={`Select ${selectionLabel}`}
            onChange={(checked) =>
              handleSelectionChange('single', checked, contract.id)
            }
          />
        ),
      }),
      TableCell({
        className: styles.Underline,
        children: (
          <Text fontWeight="bold" as="span">
            {contractId}
          </Text>
        ),
      }),
      ...(shouldShowWarningColumn
        ? [
            TableCell({
              children: hasInventoryError(contract) ? (
                <InventoryErrorPopover
                  insufficientStockProductVariants={
                    contract.billingAttempts[0]?.processingError
                      ?.insufficientStockProductVariants
                  }
                />
              ) : null,
            }),
          ]
        : []),
      TableCell({
        children: contract.customer?.displayName ?? '-',
      }),
      TableCell({
        children: productCountFormatter(contract.lines, contract.lineCount),
      }),
      TableCell({
        children: formatPrice({
          amount: contract.totalPrice?.amount,
          currency: contract.totalPrice?.currencyCode,
          locale,
        }),
      }),
      TableCell({
        children: deliveryFrequencyText(contract.deliveryPolicy),
      }),
      TableCell({
        children: contract.nextBillingDate
          ? formatDate(contract.nextBillingDate, locale)
          : '-',
      }),
      TableCell({
        children: <StatusBadge status={formatStatus(contract.status)} />,
      }),
    );
  });

  const omitSelectedResourcesByStatus = (status: string) => {
    return selectedResources.filter((contractId) =>
      contracts.some((contract) => contract.id === contractId && contract.status !== status),
    );
  };

  const filtersMarkup = (
    <IndexFilters
      key={`contracts-filters-${layoutVersion}`}
      loading={listLoading}
      tabs={tabs}
      selected={selectedTab}
      onSelect={handleTabSelect}
      sortOptions={sortOptions}
      sortSelected={sortSelected}
      onSort={onSort}
      mode="default"
      setMode={() => {}}
      onQueryChange={() => {}}
      onQueryClear={() => {}}
      cancelAction={{
        onAction: () => {},
        disabled: false,
        loading: false,
      }}
      canCreateNewView={false}
      filters={[]}
      onClearAll={() => {}}
      hideFilters
      hideQueryField
    />
  );

  const tableMarkup =
    contracts.length > 0
      ? createElement(
          's-table' as any,
          {
            key: `contracts-table-${layoutVersion}`,
            role: 'table',
          },
          createElement(
            's-table-header-row' as any,
            {role: 'row'},
            createElement(
              's-table-header' as any,
              {role: 'columnheader'},
              <SelectionCheckbox
                id="contracts-select-all"
                checked={allResourcesSelected}
                label={`Select all ${t('table.resourceName.plural')}`}
                onChange={(checked) => handleSelectionChange('all', checked)}
              />,
            ),
            TableHeader({
              title: t('table.headings.contract'),
              listSlot: 'primary',
            }),
            ...(shouldShowWarningColumn
              ? [
                  TableHeader({
                    title: t('table.headings.warning'),
                    hidden: true,
                  }),
                ]
              : []),
            TableHeader({
              title: t('table.headings.customer'),
            }),
            TableHeader({
              title: t('table.headings.product'),
            }),
            TableHeader({
              title: t('table.headings.price'),
              format: 'numeric',
            }),
            TableHeader({
              title: t('table.headings.deliveryFrequency'),
            }),
            TableHeader({
              title: t('table.headings.nextBillingDate', {
                defaultValue: 'Next billing',
              }),
            }),
            TableHeader({
              title: t('table.headings.status'),
              listSlot: 'secondary',
            }),
          ),
          createElement(
            's-table-body' as any,
            {role: 'rowgroup'},
            contractRowsMarkup,
          ),
        )
      : null;

  const bulkActionsMarkup =
    selectedResources.length > 0 ? (
      <>
        <Box padding="200">
          <InlineStack gap="200" blockAlign="center" wrap>
            {bulkActions.map((action) => (
              <Button
                key={String(action.content)}
                disabled={action.disabled}
                onClick={action.onAction}
              >
                {action.content}
              </Button>
            ))}
          </InlineStack>
        </Box>
        <Divider />
      </>
    ) : null;

  return (
    <>
      <div ref={containerRef}>
        <BlockStack gap="0">
          {bulkActionsMarkup}
          {filtersMarkup}
          {tableMarkup ? <Divider /> : null}
          {tableMarkup ? (
            tableMarkup
          ) : (
            <BlockStack gap="0">
              {emptyStateMarkup}
            </BlockStack>
          )}
        </BlockStack>
      </div>
      <BulkActionModal
        selectedResources={omitSelectedResourcesByStatus(
          SubscriptionContractStatus.Paused,
        )}
        open={pauseModalOpen}
        action="bulk-pause"
        closeModal={closePauseModal}
      />
      <BulkActionModal
        selectedResources={omitSelectedResourcesByStatus(
          SubscriptionContractStatus.Active,
        )}
        open={activateModalOpen}
        action="bulk-activate"
        closeModal={closeActivateModal}
      />
      <BulkActionModal
        selectedResources={omitSelectedResourcesByStatus(
          SubscriptionContractStatus.Cancelled,
        )}
        open={cancelModalOpen}
        action="bulk-cancel"
        closeModal={closeCancelModal}
      />
    </>
  );
}
