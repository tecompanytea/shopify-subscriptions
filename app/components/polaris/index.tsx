import React, {
  Children,
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

type ResponsiveValue<T> =
  | T
  | {
      xs?: T;
      sm?: T;
      md?: T;
      lg?: T;
      xl?: T;
    };

export type SelectionType = 'all' | 'single' | 'range';
export type TabProps = {id: string; content: React.ReactNode};
export type MenuActionDescriptor = {
  content: React.ReactNode;
  onAction?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  helpText?: React.ReactNode;
  icon?: any;
};

export type IndexFiltersProps = {
  sortOptions: Array<{
    label: string;
    value: string;
    directionLabel?: string;
  }>;
};

export type GridProps = {
  columns?: ResponsiveValue<number | string>;
  gap?: ResponsiveValue<string>;
  alignItems?: string;
  children?: React.ReactNode;
};

export type GridCellProps = {
  columnSpan?: ResponsiveValue<number>;
  children?: React.ReactNode;
};

const BREAKPOINTS = {
  sm: 490,
  md: 768,
  lg: 1040,
  xl: 1440,
};

const IS_TEST_ENV = process.env.NODE_ENV === 'test';

const SPACING_MAP: Record<string, string> = {
  '0': 'none',
  none: 'none',
  '025': 'small-200',
  '050': 'small-100',
  '100': 'small',
  '150': 'base',
  '200': 'large',
  '300': 'large-100',
  '400': 'large-200',
  '500': 'large-300',
  '800': 'large-500',
  '1000': 'large-500',
  '1200': 'large-500',
};

function getWindowWidth() {
  if (typeof window === 'undefined') return BREAKPOINTS.lg;
  return window.innerWidth;
}

function useWindowWidth() {
  const [width, setWidth] = useState(getWindowWidth);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return width;
}

function pickResponsiveValue<T>(value: ResponsiveValue<T> | undefined, width: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const responsive = value as {
    xs?: T;
    sm?: T;
    md?: T;
    lg?: T;
    xl?: T;
  };

  if (width >= BREAKPOINTS.xl && responsive.xl !== undefined) return responsive.xl;
  if (width >= BREAKPOINTS.lg && responsive.lg !== undefined) return responsive.lg;
  if (width >= BREAKPOINTS.md && responsive.md !== undefined) return responsive.md;
  if (width >= BREAKPOINTS.sm && responsive.sm !== undefined) return responsive.sm;
  return responsive.xs;
}

function mapSpacing(value?: string) {
  if (!value) return undefined;
  return SPACING_MAP[value] || value;
}

function mapTone(tone?: string) {
  if (!tone) return undefined;
  if (tone === 'subdued') return 'neutral';
  if (tone === 'attention') return 'warning';
  return tone;
}

function mapButtonVariant(variant?: string) {
  if (!variant) return undefined;
  if (variant === 'plain') return 'tertiary';
  return variant;
}

function mapAlign(value?: string) {
  switch (value) {
    case 'start':
      return 'start';
    case 'end':
      return 'end';
    case 'center':
      return 'center';
    case 'space-between':
      return 'space-between';
    case 'space-around':
      return 'space-around';
    default:
      return undefined;
  }
}

function mapWrap(value?: boolean) {
  return value === false ? 'nowrap' : undefined;
}

function normalizeChildren(children: React.ReactNode) {
  return Children.toArray(children);
}

function isUrlLike(value?: string) {
  return Boolean(value && (value.startsWith('/') || value.startsWith('http')));
}

export function useBreakpoints() {
  const width = useWindowWidth();

  return {
    smDown: width < BREAKPOINTS.md,
    mdUp: width >= BREAKPOINTS.md,
    lgUp: width >= BREAKPOINTS.lg,
  };
}

export function useSetIndexFiltersMode() {
  const [mode, setMode] = useState<'default' | 'editing'>('default');
  return {mode, setMode};
}

export function Box(props: any) {
  return <s-box {...props}>{props.children}</s-box>;
}

export function Button({
  children,
  url,
  submit,
  type,
  icon,
  accessibilityLabel,
  ...rest
}: any) {
  const hiddenSubmitRef = useRef<HTMLButtonElement>(null);
  const actualType = submit ? 'submit' : type;
  const disabled = Boolean(rest.disabled);

  if (IS_TEST_ENV) {
    if (url) {
      return (
        <a
          {...rest}
          href={url}
          aria-label={accessibilityLabel}
          aria-disabled={disabled ? 'true' : undefined}
          onClick={disabled ? undefined : rest.onClick}
        >
          {children}
        </a>
      );
    }

    return (
      <button
        {...rest}
        type={actualType ?? 'button'}
        disabled={disabled}
        aria-label={accessibilityLabel}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={rest.onClick}
      >
        {children}
      </button>
    );
  }

  return (
    <>
      {submit ? (
        <button
          ref={hiddenSubmitRef}
          type="submit"
          hidden
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : null}
      <s-button
        {...rest}
        role={url ? 'link' : 'button'}
        href={url}
        type={actualType}
        disabled={disabled}
        variant={mapButtonVariant(rest.variant)}
        tone={mapTone(rest.tone)}
        icon={icon}
        accessibilityLabel={accessibilityLabel}
        aria-label={accessibilityLabel}
        aria-disabled={disabled ? 'true' : undefined}
        onClick={(event: any) => {
          if (submit) hiddenSubmitRef.current?.click();
          rest.onClick?.(event);
        }}
      >
        {children}
      </s-button>
    </>
  );
}

function renderActionNode(
  action: any,
  key?: React.Key,
  defaultVariant: string = 'secondary',
) {
  if (!action) return null;
  if (isValidElement(action)) return key !== undefined ? cloneElement(action as any, {key}) : action;

  return (
    <Button
      key={key}
      variant={action.variant ?? defaultVariant}
      tone={action.destructive ? 'critical' : action.tone}
      disabled={action.disabled}
      loading={action.loading}
      icon={action.icon}
      accessibilityLabel={action.accessibilityLabel}
      onClick={action.onAction}
    >
      {action.content || action.children}
    </Button>
  );
}

export function Link({
  children,
  url,
  onClick,
  accessibilityLabel,
  removeUnderline: _removeUnderline,
  ...rest
}: any) {
  if (!url && onClick) {
    return (
      <Button
        {...rest}
        variant="tertiary"
        accessibilityLabel={accessibilityLabel}
        onClick={onClick}
      >
        {children}
      </Button>
    );
  }

  return (
    <s-link
      {...rest}
      role="link"
      href={url}
      accessibilityLabel={accessibilityLabel}
      aria-label={accessibilityLabel}
    >
      {children}
    </s-link>
  );
}

export function Badge({children, tone, ...rest}: any) {
  return (
    <s-badge {...rest} tone={mapTone(tone)}>
      {children}
    </s-badge>
  );
}

export function Banner({children, tone, title, ...rest}: any) {
  return (
    <s-banner {...rest} heading={title} tone={mapTone(tone)}>
      <BlockStack gap="200">
        {title ? (
          <Text as="h3" variant="headingMd">
            {title}
          </Text>
        ) : null}
        {children}
      </BlockStack>
    </s-banner>
  );
}

export function Divider({direction, color, ...rest}: any) {
  return (
    <s-divider
      {...rest}
      direction={direction === 'vertical' ? 'inline' : 'block'}
      color={color}
    />
  );
}

export function Icon({source, tone, ...rest}: any) {
  return <s-icon {...rest} type={source} tone={mapTone(tone)} />;
}

export function Thumbnail({source, alt, size, ...rest}: any) {
  if (!isUrlLike(source)) {
    return (
      <s-box
        {...rest}
        role="img"
        accessibilityLabel={alt}
        padding="small"
        border="base"
        borderRadius="base"
        inlineSize="48px"
        blockSize="48px"
      >
        <s-icon type={source || 'image'} tone="neutral" />
      </s-box>
    );
  }

  if (IS_TEST_ENV) {
    return <img {...rest} src={source} alt={alt} data-size={size} />;
  }

  return <s-thumbnail {...rest} src={source} alt={alt} size={size} />;
}

export function Image({source, ...rest}: any) {
  // Polaris's <Image> API uses `source` but emits a regular <img src="..." />;
  // mirror that in the wrapper so consumers (and tests) see the expected src.
  return <img src={source} {...rest} />;
}

export function Spinner(props: any) {
  return <s-spinner {...props} />;
}

export function Tag({children}: any) {
  return <Badge>{children}</Badge>;
}

export function Scrollable({children, style, vertical, horizontal, ...rest}: any) {
  return (
    <s-box
      {...rest}
      style={{
        overflowY: vertical ? 'auto' : undefined,
        overflowX: horizontal ? 'auto' : horizontal === false ? 'hidden' : undefined,
        ...style,
      }}
    >
      {children}
    </s-box>
  );
}

export function Text({
  as = 'span',
  variant,
  children,
  tone,
  fontWeight,
  breakWord,
  style,
  ...rest
}: any) {
  const textStyle = {
    fontWeight:
      fontWeight === 'bold'
        ? 700
        : fontWeight === 'semibold' || fontWeight === 'medium'
          ? 600
          : undefined,
    wordBreak: breakWord ? 'break-word' : undefined,
    whiteSpace: rest?.whiteSpace,
    ...style,
  };

  if (String(as).startsWith('h') || String(variant).startsWith('heading')) {
    return (
      <s-heading {...rest} style={textStyle}>
        {children}
      </s-heading>
    );
  }

  if (as === 'p') {
    return (
      <s-paragraph {...rest} tone={mapTone(tone)} style={textStyle}>
        {children}
      </s-paragraph>
    );
  }

  return (
    <s-text {...rest} tone={mapTone(tone)} style={textStyle}>
      {children}
    </s-text>
  );
}

export function BlockStack({
  children,
  gap,
  align,
  inlineAlign,
  ...rest
}: any) {
  const width = useWindowWidth();
  return (
    <s-stack
      {...rest}
      direction="block"
      gap={mapSpacing(pickResponsiveValue(gap, width))}
      justifyContent={mapAlign(inlineAlign || align)}
      alignItems={mapAlign(align)}
    >
      {children}
    </s-stack>
  );
}

export function InlineStack({
  children,
  gap,
  align,
  blockAlign,
  wrap,
  ...rest
}: any) {
  const width = useWindowWidth();
  return (
    <s-stack
      {...rest}
      direction="inline"
      gap={mapSpacing(pickResponsiveValue(gap, width))}
      justifyContent={mapAlign(align)}
      alignItems={mapAlign(blockAlign)}
      style={{flexWrap: mapWrap(wrap)}}
    >
      {children}
    </s-stack>
  );
}

function LayoutSectionComponent({children}: any) {
  return <s-box>{children}</s-box>;
}

LayoutSectionComponent.displayName = 'Layout.Section';

export function Layout({children}: any) {
  const width = useWindowWidth();
  const sections = normalizeChildren(children);
  const hasAside = sections.some(
    (child: any) => isValidElement(child) && (child as any).props.variant === 'oneThird',
  );
  const twoColumn = hasAside && width >= BREAKPOINTS.md;

  return (
    <s-grid
      gap="large-200"
      gridTemplateColumns={twoColumn ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1fr'}
    >
      {sections.map((child: any, index) => {
        if (!isValidElement(child)) return <Fragment key={index}>{child}</Fragment>;

        const isAside = (child as any).props.variant === 'oneThird';
        const gridColumn = twoColumn && !isAside && index > 1 ? 'span 2' : undefined;

        return (
          <s-grid-item key={child.key ?? index} gridColumn={gridColumn}>
            {child}
          </s-grid-item>
        );
      })}
    </s-grid>
  );
}

Layout.Section = LayoutSectionComponent as any;

export function Card({children, padding, title, ...rest}: any) {
  return (
    <s-section {...rest} heading={title} padding={padding === '0' ? 'none' : undefined}>
      {children}
    </s-section>
  );
}

function ModalSection({children}: any) {
  return <s-box padding="base">{children}</s-box>;
}

export function Modal({
  open,
  onClose,
  title,
  primaryAction,
  secondaryActions,
  footer,
  children,
}: any) {
  if (!open) return null;

  const primaryActionNode = renderActionNode(primaryAction, undefined, 'primary');
  const secondaryActionNodes = Array.isArray(secondaryActions)
    ? secondaryActions.map((action, index) => renderActionNode(action, index))
    : renderActionNode(secondaryActions);

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <s-section padding="none">
        <BlockStack gap="0">
          <s-box padding="base">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h2" variant="headingMd">
                {title}
              </Text>
              <Button accessibilityLabel="Close" onClick={onClose}>
                Close
              </Button>
            </InlineStack>
          </s-box>
          {children}
          {(secondaryActionNodes || primaryActionNode || footer) ? (
            <s-box padding="base">
              <BlockStack gap="200">
                {footer}
                <InlineStack align="end" gap="200">
                  {secondaryActionNodes}
                  {primaryActionNode}
                </InlineStack>
              </BlockStack>
            </s-box>
          ) : null}
        </BlockStack>
      </s-section>
    </div>
  );
}

Modal.Section = ModalSection as any;

export function FormLayout({children}: any) {
  return <BlockStack gap="200">{children}</BlockStack>;
}

FormLayout.Group = function FormLayoutGroup({children}: any) {
  return <InlineGrid columns={{xs: '1fr', md: '1fr 1fr'}} gap="200">{children}</InlineGrid>;
};

export function FooterHelp({children}: any) {
  return (
    <s-box paddingBlockStart="large">
      <s-paragraph tone="neutral">{children}</s-paragraph>
    </s-box>
  );
}

export function EmptyState({
  heading,
  image,
  action,
  children,
}: any) {
  return (
    <s-section>
      <BlockStack gap="300" align="center" inlineAlign="center">
        {image ? <img src={image} alt="" style={{maxWidth: 160}} /> : null}
        <Text as="h2" variant="headingMd">
          {heading}
        </Text>
        {children}
        {action ? (
          <Button
            variant="primary"
            icon={action.icon}
            accessibilityLabel={action.accessibilityLabel}
            onClick={action.onAction}
          >
            {action.content}
          </Button>
        ) : null}
      </BlockStack>
    </s-section>
  );
}

export function Page({
  title,
  subtitle,
  backAction,
  primaryAction,
  secondaryActions,
  titleMetadata,
  narrowWidth,
  children,
}: any) {
  const primaryActionNode = renderActionNode(primaryAction, undefined, 'primary');
  const secondaryActionNodes = Array.isArray(secondaryActions)
    ? secondaryActions.map((action, index) => renderActionNode(action, index))
    : renderActionNode(secondaryActions);

  return (
    <s-page inlineSize={narrowWidth ? 'small' : 'base'}>
      {(title || subtitle || backAction || titleMetadata || primaryActionNode || secondaryActionNodes) ? (
        <s-box paddingBlockEnd="large-200">
          <BlockStack gap="200">
            {backAction ? <Link url={backAction.url}>{backAction.content}</Link> : null}
            <InlineStack align="space-between" blockAlign="start" gap="200">
              <BlockStack gap="100">
                {title ? (
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h1" variant="headingLg">
                      {title}
                    </Text>
                    {titleMetadata}
                  </InlineStack>
                ) : null}
                {subtitle ? (
                  <Text as="p" tone="subdued">
                    {subtitle}
                  </Text>
                ) : null}
              </BlockStack>
              {(primaryActionNode || secondaryActionNodes) ? (
                <InlineStack align="end" gap="200">
                  {secondaryActionNodes}
                  {primaryActionNode}
                </InlineStack>
              ) : null}
            </InlineStack>
          </BlockStack>
        </s-box>
      ) : null}
      {children}
    </s-page>
  );
}

export function PageActions({primaryAction, secondaryActions}: any) {
  const primaryActionNode = renderActionNode(primaryAction, undefined, 'primary');
  const secondaryActionNodes = Array.isArray(secondaryActions)
    ? secondaryActions.map((action, index) => renderActionNode(action, index))
    : renderActionNode(secondaryActions);

  return (
    <s-box paddingBlockStart="large-200">
      <InlineStack align="end" gap="200">
        {secondaryActionNodes}
        {primaryActionNode}
      </InlineStack>
    </s-box>
  );
}

export function List({children, type}: any) {
  const Tag = type === 'number' ? 's-ordered-list' : 's-unordered-list';
  return <Tag>{children}</Tag>;
}

List.Item = function ListItem({children}: any) {
  return <s-list-item>{children}</s-list-item>;
};

export function InlineError({message}: any) {
  return <s-paragraph tone="critical">{message}</s-paragraph>;
}

export function Pagination({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  accessibilityLabels,
}: any) {
  return (
    <InlineStack gap="200">
      <Button
        icon="chevron-left"
        accessibilityLabel={accessibilityLabels?.previous || 'Previous'}
        disabled={!hasPrevious}
        onClick={onPrevious}
      />
      <Button
        icon="chevron-right"
        accessibilityLabel={accessibilityLabels?.next || 'Next'}
        disabled={!hasNext}
        onClick={onNext}
      />
    </InlineStack>
  );
}

export function EmptySearchResult({title, description, withIllustration}: any) {
  return (
    <s-section>
      <BlockStack gap="200" align="center" inlineAlign="center">
        {withIllustration ? (
          <img src="/images/empty-subscriptions-list-state.png" alt="" style={{maxWidth: 160}} />
        ) : null}
        <Text as="h3" variant="headingMd">
          {title}
        </Text>
        <Text as="p">{description}</Text>
      </BlockStack>
    </s-section>
  );
}

export function ActionList({
  items,
  sections,
  actionRole: _actionRole,
}: {
  items?: MenuActionDescriptor[];
  sections?: Array<{items: MenuActionDescriptor[]}>;
  actionRole?: string;
}) {
  const resolvedSections =
    sections ?? (items ? [{items}] : []);

  return (
    <BlockStack gap="100">
      {resolvedSections.map((section, sectionIndex) => (
        <BlockStack key={sectionIndex} gap="100">
          {sectionIndex > 0 ? <Divider /> : null}
          {section.items.map((item, itemIndex) => (
            <Button
              key={`${sectionIndex}-${itemIndex}`}
              variant="tertiary"
              tone={item.destructive ? 'critical' : undefined}
              disabled={item.disabled}
              icon={item.icon}
              onClick={item.onAction}
            >
              <BlockStack gap="0" align="start">
                <Text as="span">{item.content}</Text>
                {item.helpText ? (
                  <Text as="span" tone="subdued">
                    {item.helpText}
                  </Text>
                ) : null}
              </BlockStack>
            </Button>
          ))}
        </BlockStack>
      ))}
    </BlockStack>
  );
}

export function Popover({active, activator, onClose, children}: any) {
  const id = useId();
  const ref = useRef<any>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (active) {
      ref.current.showOverlay?.();
    } else {
      ref.current.hideOverlay?.();
    }
  }, [active]);

  const activatorNode = isValidElement(activator)
    ? cloneElement(activator as any, {
        command: active ? '--hide' : '--show',
        commandFor: id,
      })
    : activator;

  return (
    <>
      {activatorNode}
      <s-popover id={id} ref={ref} onHide={onClose}>
        {children}
      </s-popover>
    </>
  );
}

export function Tooltip({content, children}: any) {
  // Temporary Shopify web-component workaround
  return isValidElement(children)
    ? cloneElement(children as any, {title: content})
    : children;
}

export function Grid({children, columns, gap, alignItems}: GridProps) {
  const width = useWindowWidth();
  const currentColumns = pickResponsiveValue(columns, width);
  const gridTemplateColumns =
    typeof currentColumns === 'number'
      ? `repeat(${currentColumns}, minmax(0, 1fr))`
      : currentColumns;

  return (
    <s-grid
      gap={mapSpacing(pickResponsiveValue(gap, width) as string) as any}
      alignItems={
        alignItems === 'start' || alignItems === 'end' || alignItems === 'center'
          ? alignItems
          : undefined
      }
      gridTemplateColumns={gridTemplateColumns}
    >
      {children}
    </s-grid>
  );
}

Grid.Cell = function GridCell({children, columnSpan}: GridCellProps) {
  const width = useWindowWidth();
  const span = pickResponsiveValue(columnSpan, width);
  return (
    <s-grid-item gridColumn={span ? `span ${span}` : undefined}>
      {children}
    </s-grid-item>
  );
};

export function InlineGrid({children, columns, gap, alignItems}: any) {
  return (
    <Grid columns={columns} gap={gap} alignItems={alignItems}>
      {children}
    </Grid>
  );
}

type IndexTableContextValue = {
  selectable?: boolean;
  resourceName?: {singular?: string; plural?: string};
  onSelectionChange?: (
    selectionType: SelectionType,
    isSelecting: boolean,
    selection?: string | [number, number],
  ) => void;
};

const IndexTableContext = createContext<IndexTableContextValue>({});

export function useIndexResourceState(
  resources: Array<string | {id: string}>,
) {
  const resourceIds = useMemo(
    () => resources.map((resource) => (typeof resource === 'string' ? resource : resource.id)),
    [resources],
  );
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

  useEffect(() => {
    setSelectedResources((current) => {
      const filtered = current.filter((id) => resourceIds.includes(id));

      if (
        filtered.length === current.length &&
        filtered.every((id, index) => id === current[index])
      ) {
        return current;
      }

      return filtered;
    });
  }, [resourceIds]);

  const allResourcesSelected =
    resourceIds.length > 0 && selectedResources.length === resourceIds.length;

  function handleSelectionChange(
    selectionType: SelectionType,
    isSelecting: boolean,
    selection?: string | [number, number],
  ) {
    if (selectionType === 'all') {
      setSelectedResources(isSelecting ? resourceIds : []);
      return;
    }

    if (typeof selection === 'string') {
      setSelectedResources((current) =>
        isSelecting
          ? Array.from(new Set([...current, selection]))
          : current.filter((id) => id !== selection),
      );
    }
  }

  return {
    selectedResources,
    allResourcesSelected,
    clearSelection: () => setSelectedResources([]),
    handleSelectionChange,
  };
}

export function IndexFilters({
  tabs = [],
  selected = 0,
  onSelect,
  sortOptions = [],
  sortSelected = [],
  onSort,
  loading,
}: any) {
  return (
    <s-section padding="base">
      <InlineStack align="space-between" blockAlign="center" gap="200">
        <InlineStack gap="200" role="tablist">
          {tabs.map((tab: TabProps, index: number) => (
            <Button
              key={tab.id}
              variant={index === selected ? 'primary' : 'secondary'}
              role="tab"
              aria-selected={index === selected}
              onClick={() => onSelect?.(index)}
            >
              {tab.content}
            </Button>
          ))}
        </InlineStack>
        <InlineStack gap="200" blockAlign="center">
          {loading ? <Spinner /> : null}
          {sortOptions.length ? (
            <Select
              label="Sort the results"
              labelHidden
              options={sortOptions.map((option: any) => ({
                label: option.directionLabel
                  ? `${option.label} · ${option.directionLabel}`
                  : option.label,
                value: option.value,
              }))}
              value={sortSelected?.[0] ?? sortOptions[0]?.value}
              onChange={(value: string) => onSort?.([value])}
            />
          ) : null}
        </InlineStack>
      </InlineStack>
    </s-section>
  );
}

type IndexTableProps = {
  headings: Array<{title: React.ReactNode; hidden?: boolean}>;
  itemCount: number;
  resourceName?: any;
  selectedItemsCount?: number | string;
  emptyState?: React.ReactNode;
  onSelectionChange?: (
    selectionType: SelectionType,
    isSelecting: boolean,
    selection?: string | [number, number],
  ) => void;
  selectable?: boolean;
  promotedBulkActions?: Array<{content: React.ReactNode; onAction: () => void; disabled?: boolean}>;
  children?: React.ReactNode;
};

export function IndexTable({
  headings,
  itemCount,
  selectedItemsCount,
  onSelectionChange,
  selectable,
  promotedBulkActions,
  children,
  resourceName,
  emptyState,
}: IndexTableProps) {
  const isSelectable = selectable ?? Boolean(onSelectionChange);
  const allSelected = selectedItemsCount === 'All';
  const selectedCount =
    selectedItemsCount === 'All' ? Number.MAX_SAFE_INTEGER : Number(selectedItemsCount || 0);

  return (
    <IndexTableContext.Provider
      value={{selectable: isSelectable, resourceName, onSelectionChange}}
    >
      <BlockStack gap="0">
        {selectedCount > 0 && promotedBulkActions?.length ? (
          <s-section padding="base">
            <InlineStack gap="200" blockAlign="center">
              {promotedBulkActions.map((action, index) => (
                <Button
                  key={index}
                  disabled={action.disabled}
                  onClick={action.onAction}
                >
                  {action.content}
                </Button>
              ))}
            </InlineStack>
          </s-section>
        ) : null}
        {React.createElement(
          's-table' as any,
          {role: 'table'},
          React.createElement(
            's-table-header' as any,
            null,
            React.createElement(
              's-table-header-row' as any,
              {role: 'row'},
              ...[
                isSelectable
                  ? React.createElement(
                      's-table-cell' as any,
                      {key: '__select__', role: 'columnheader'},
                      React.createElement(Checkbox as any, {
                        label: '',
                        accessibilityLabel: `Select all ${resourceName?.plural ?? 'items'}`,
                        checked: allSelected,
                        onChange: (checked: boolean) =>
                          onSelectionChange?.('all', checked),
                      }),
                    )
                  : null,
                ...headings.map((heading, index) =>
                  React.createElement(
                    's-table-cell' as any,
                    {
                      key: index,
                      role: 'columnheader',
                      accessibilityVisibility: heading.hidden
                        ? 'exclusive'
                        : undefined,
                    },
                    heading.title,
                  ),
                ),
              ].filter(Boolean),
            ),
          ),
          React.createElement('s-table-body' as any, {role: 'rowgroup'}, children),
        )}
        {itemCount === 0 ? emptyState : null}
      </BlockStack>
    </IndexTableContext.Provider>
  );
}

IndexTable.Row = function IndexTableRow({
  children,
  id,
  selected,
  onClick,
  accessibilityLabel,
}: any) {
  const {selectable, resourceName, onSelectionChange} = useContext(IndexTableContext);

  return (
    React.createElement(
      's-table-row' as any,
      {
        id,
        role: 'row',
        onClick,
        style: {cursor: onClick ? 'pointer' : undefined},
      },
      ...[
        selectable
          ? React.createElement(
              's-table-cell' as any,
              {
                key: '__select__',
                role: 'cell',
                onClick: (event: any) => event.stopPropagation(),
              },
              React.createElement(Checkbox as any, {
                label: '',
                accessibilityLabel:
                  accessibilityLabel ??
                  `Select ${resourceName?.singular ?? 'item'}`,
                checked: selected,
                onChange: (checked: boolean) =>
                  onSelectionChange?.('single', checked, id),
              }),
            )
          : null,
        ...normalizeChildren(children),
      ].filter(Boolean),
    )
  );
};

IndexTable.Cell = function IndexTableCell({children, className, onClick}: any) {
  return React.createElement(
    's-table-cell' as any,
    {role: 'cell', className, onClick},
    children,
  );
};

function renderFieldMeta({
  helpText,
  error,
}: {
  helpText?: React.ReactNode;
  error?: React.ReactNode;
}) {
  return (
    <>
      {helpText ? <s-paragraph tone="neutral">{helpText}</s-paragraph> : null}
      {error ? <s-paragraph tone="critical">{error}</s-paragraph> : null}
    </>
  );
}

function getIconFromPrefix(prefix: React.ReactNode) {
  if (!isValidElement(prefix)) return undefined;
  return (prefix as any).props?.source;
}

export function TextField({
  label,
  labelHidden,
  helpText,
  error,
  value,
  onChange,
  type,
  prefix,
  suffix,
  autoComplete,
  multiline,
  connectedLeft,
  connectedRight,
  ...rest
}: any) {
  const fieldId = rest.id || rest.name || useId();
  const fieldLabel = labelHidden ? undefined : label;
  const accessibilityLabel = labelHidden ? label : undefined;
  const commonProps = {
    ...rest,
    id: fieldId,
    name: rest.name,
    value: value ?? '',
    label: fieldLabel,
    autocomplete: autoComplete,
    required: rest.required,
    disabled: rest.disabled,
    readOnly: rest.readOnly,
    placeholder: rest.placeholder,
    accessibilityLabel,
  };

  const handleChange = (event: any) => {
    const nextValue = event?.currentTarget?.value ?? event?.target?.value ?? '';
    onChange?.(nextValue, event);
  };

  if (IS_TEST_ENV) {
    const inputProps = {
      id: fieldId,
      name: rest.name,
      value: value ?? '',
      required: rest.required,
      disabled: rest.disabled,
      readOnly: rest.readOnly,
      placeholder: rest.placeholder,
      autoComplete,
      'aria-label': accessibilityLabel,
      onChange: handleChange,
    } as const;

    const input = multiline ? (
      <textarea
        {...inputProps}
        rows={rest.multiline === true ? 4 : rest.multiline}
      />
    ) : (
      <input
        {...inputProps}
        type={type === 'search' ? 'search' : type === 'number' ? 'number' : 'text'}
      />
    );

    const fieldWithConnectedContent =
      connectedLeft || connectedRight ? (
        <InlineStack gap="200" blockAlign="end">
          {connectedLeft ? <div>{connectedLeft}</div> : null}
          <div style={{flexGrow: 1}}>{input}</div>
          {connectedRight ? <div>{connectedRight}</div> : null}
        </InlineStack>
      ) : (
        input
      );

    return (
      <BlockStack gap="100">
        {fieldLabel ? <label htmlFor={fieldId}>{fieldLabel}</label> : null}
        {fieldWithConnectedContent}
        {renderFieldMeta({helpText, error})}
      </BlockStack>
    );
  }

  const field =
    multiline ? (
      <s-text-area
        {...commonProps}
        rows={rest.multiline === true ? 4 : rest.multiline}
        onChange={handleChange}
      />
    ) : type === 'number' ? (
      <s-number-field
        {...commonProps}
        suffix={typeof suffix === 'string' ? suffix : undefined}
        prefix={typeof prefix === 'string' ? prefix : undefined}
        onChange={handleChange}
      />
    ) : type === 'search' ? (
      <s-search-field {...commonProps} onChange={handleChange} />
    ) : (
      <s-text-field
        {...commonProps}
        icon={getIconFromPrefix(prefix)}
        suffix={typeof suffix === 'string' ? suffix : undefined}
        prefix={typeof prefix === 'string' ? prefix : undefined}
        onChange={handleChange}
      />
    );

  const fieldWithConnectedContent =
    connectedLeft || connectedRight ? (
      <InlineStack gap="200" blockAlign="end">
        {connectedLeft ? <div>{connectedLeft}</div> : null}
        <div style={{flexGrow: 1}}>{field}</div>
        {connectedRight ? <div>{connectedRight}</div> : null}
      </InlineStack>
    ) : (
      field
    );

  return (
    <BlockStack gap="100">
      {fieldWithConnectedContent}
      {rest.name ? <input type="hidden" name={rest.name} value={value ?? ''} /> : null}
      {renderFieldMeta({helpText, error})}
    </BlockStack>
  );
}

export function Select({
  label,
  labelHidden,
  options = [],
  value,
  onChange,
  error,
  helpText,
  ...rest
}: any) {
  const fieldId = rest.id || rest.name || useId();
  const fieldLabel = labelHidden ? undefined : label;
  const accessibilityLabel = labelHidden ? label : undefined;
  const handleChange = (event: any) => {
    const nextValue = event?.currentTarget?.value ?? event?.target?.value ?? '';
    onChange?.(nextValue, event);
  };

  if (IS_TEST_ENV) {
    return (
      <BlockStack gap="100">
        {fieldLabel ? <label htmlFor={fieldId}>{fieldLabel}</label> : null}
        <select
          {...rest}
          id={fieldId}
          value={value ?? ''}
          aria-label={accessibilityLabel}
          onChange={handleChange}
        >
          {options.map((option: any) => {
            if ('options' in option) {
              return (
                <optgroup key={option.title} label={option.title}>
                  {option.options.map((nestedOption: any) => (
                    <option key={nestedOption.value} value={nestedOption.value}>
                      {nestedOption.label}
                    </option>
                  ))}
                </optgroup>
              );
            }

            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
        {renderFieldMeta({helpText, error})}
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="100">
      <s-select
        {...rest}
        id={fieldId}
        value={value ?? ''}
        label={fieldLabel}
        accessibilityLabel={accessibilityLabel}
        onChange={handleChange}
      >
        {options.map((option: any) => {
          if ('options' in option) {
            return (
              <s-option-group key={option.title} label={option.title}>
                {option.options.map((nestedOption: any) => (
                  <s-option key={nestedOption.value} value={nestedOption.value}>
                    {nestedOption.label}
                  </s-option>
                ))}
              </s-option-group>
            );
          }

          return (
            <s-option key={option.value} value={option.value}>
              {option.label}
            </s-option>
          );
        })}
      </s-select>
      {rest.name ? <input type="hidden" name={rest.name} value={value ?? ''} /> : null}
      {renderFieldMeta({helpText, error})}
    </BlockStack>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  helpText,
  error,
  accessibilityLabel,
  ...rest
}: any) {
  const id = rest.id || rest.name || useId();
  const handleChange = (event: any) => {
    const nextValue =
      event?.type === 'click'
        ? !Boolean(checked)
        : Boolean(
            event?.currentTarget?.checked ?? event?.target?.checked ?? !checked,
          );
    onChange?.(nextValue, rest.id);
  };

  if (IS_TEST_ENV) {
    return (
      <BlockStack gap="100">
        <InlineStack gap="200" blockAlign="center">
          <input
            {...rest}
            id={id}
            type="checkbox"
            checked={Boolean(checked)}
            aria-label={accessibilityLabel || label || 'Select item'}
            onChange={handleChange}
          />
          {label ? <label htmlFor={id}>{label}</label> : null}
        </InlineStack>
        {renderFieldMeta({helpText, error})}
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="100">
      <InlineStack gap="200" blockAlign="center">
        <s-checkbox
          {...rest}
          id={id}
          checked={Boolean(checked)}
          onChange={handleChange}
          onClick={handleChange}
          role="checkbox"
          aria-checked={Boolean(checked)}
          aria-label={accessibilityLabel || label || 'Select item'}
        />
        {label ? <label htmlFor={id}>{label}</label> : null}
      </InlineStack>
      {rest.name ? (
        <input
          type="hidden"
          name={rest.name}
          value={checked ? rest.value ?? 'on' : ''}
        />
      ) : null}
      {renderFieldMeta({helpText, error})}
    </BlockStack>
  );
}

export function RadioButton({
  label,
  checked,
  onChange,
  value,
  helpText,
  ...rest
}: any) {
  const id = rest.id || `${rest.name}-${value}`;

  if (IS_TEST_ENV) {
    return (
      <BlockStack gap="100">
        <InlineStack gap="200" blockAlign="center">
          <input
            {...rest}
            id={id}
            type="radio"
            checked={Boolean(checked)}
            value={value}
            aria-label={rest.accessibilityLabel || label}
            onChange={() => onChange?.(value, rest.id)}
          />
          <label htmlFor={id}>{label}</label>
        </InlineStack>
        {helpText ? <p>{helpText}</p> : null}
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="100">
      <InlineStack gap="200" blockAlign="center">
        <s-choice
          {...rest}
          id={id}
          selected={Boolean(checked)}
          value={value}
          role="radio"
          aria-checked={Boolean(checked)}
          aria-label={rest.accessibilityLabel || label}
          onClick={() => onChange?.(value, rest.id)}
        >
          {label}
        </s-choice>
      </InlineStack>
      {rest.name && checked ? (
        <input type="hidden" name={rest.name} value={value} />
      ) : null}
      {helpText ? <s-paragraph tone="neutral">{helpText}</s-paragraph> : null}
    </BlockStack>
  );
}
