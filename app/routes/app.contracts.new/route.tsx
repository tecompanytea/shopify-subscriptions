import {json, type ActionFunctionArgs, type LoaderFunctionArgs} from '@remix-run/node';
import {useFetcher, useLoaderData} from '@remix-run/react';
import {parseGid} from '@shopify/admin-graphql-api-utilities';
import {Modal, TitleBar} from '@shopify/app-bridge-react';
import {
  ActionList,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineStack,
  Layout,
  Link,
  Modal as PolarisModal,
  Page,
  Spinner,
  Text,
  TextField as PolarisTextField,
} from '@shopify/polaris';
import {EditIcon, PlusCircleIcon, SearchIcon, XIcon} from '@shopify/polaris-icons';
import {createPortal} from 'react-dom';
import type {Dispatch, RefObject, SetStateAction} from 'react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {authenticate} from '~/shopify.server';

const STextArea: any = 's-text-area';

type ManualSection = {
  id: string;
  title: string;
};

type CustomerAddress = {
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  provinceCode?: string;
  zip?: string;
  country?: string;
  phone?: string;
};

type CustomerOption = {
  id: string;
  displayName: string;
  email: string;
  legacyResourceId: string;
  numberOfOrders: number;
  shippingAddress?: CustomerAddress | null;
  billingAddress?: CustomerAddress | null;
};

type LoaderData = {
  customers: CustomerOption[];
  customerLoadWarning: string;
};

type CustomerActionData =
  | {
      type: 'search';
      customers: CustomerOption[];
      warning?: string;
    }
  | {
      type: 'create';
      customer: CustomerOption;
    }
  | {
      type: 'error';
      error: string;
    };

const CUSTOMERS_QUERY = `#graphql
  query CustomersForSelect {
    customers(first: 250, sortKey: NAME) {
      edges {
        node {
          id
          legacyResourceId
          displayName
          email
          numberOfOrders
          defaultAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            zip
            country
            phone
          }
        }
      }
    }
  }
`;

const SEARCH_CUSTOMERS_QUERY = `#graphql
  query SearchCustomers($query: String!) {
    customers(first: 50, query: $query) {
      edges {
        node {
          id
          legacyResourceId
          displayName
          email
          numberOfOrders
          defaultAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            zip
            country
            phone
          }
        }
      }
    }
  }
`;

const CUSTOMER_CREATE_MUTATION = `#graphql
  mutation CustomerCreateForImporter($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        displayName
        email
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const handle = {
  i18n: 'app.contracts',
};

export async function loader({request}: LoaderFunctionArgs) {
  const {admin} = await authenticate.admin(request);
  const customers: CustomerOption[] = [];
  let customerLoadWarning = '';

  try {
    const response = await admin.graphql(CUSTOMERS_QUERY);
    const result = (await response.json()) as {
      errors?: Array<{message: string}>;
      data?: {
        customers?: {
          edges?: Array<{
            node?: {
              id?: string;
              legacyResourceId?: string | number | null;
              displayName?: string;
              email?: string | null;
              numberOfOrders?: number;
              defaultAddress?: CustomerAddress | null;
            };
          }>;
        };
      };
    };

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map((error) => error.message).join('; ');
      if (errorMessage.toLowerCase().includes('access denied')) {
        customerLoadWarning =
          'Customer selector unavailable. Add read_customers scope and redeploy.';
      } else {
        customerLoadWarning = `Unable to load customers: ${errorMessage}`;
      }
    } else {
      for (const edge of result.data?.customers?.edges ?? []) {
        const node = edge.node;
        if (!node?.id) continue;
        customers.push(mapCustomerNode(node));
      }
    }
  } catch {
    customerLoadWarning =
      'Unable to load customers right now. Customer selector may be incomplete.';
  }

  return json<LoaderData>({
    customers,
    customerLoadWarning,
  });
}

export async function action({request}: ActionFunctionArgs) {
  const {admin} = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'search_customers') {
    return json(await searchCustomers(admin, formData));
  }

  if (intent === 'create_customer') {
    return json(await createCustomer(admin, formData));
  }

  return json<CustomerActionData>(
    {
      type: 'error',
      error: 'Unknown action intent.',
    },
    {status: 400},
  );
}

export default function CreateManualSubscriptionPage() {
  const {t} = useTranslation('app.contracts');
  const {customers, customerLoadWarning} = useLoaderData<typeof loader>();
  const customerSearchFetcher = useFetcher<CustomerActionData>();
  const customerCreateFetcher = useFetcher<CustomerActionData>();
  const submitCustomerSearch = customerSearchFetcher.submit;

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>(() =>
    sortCustomerOptions(customers),
  );
  const [customerInputValue, setCustomerInputValue] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteDraftText, setNoteDraftText] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [createCustomerFirstNameInput, setCreateCustomerFirstNameInput] =
    useState('');
  const [createCustomerLastNameInput, setCreateCustomerLastNameInput] =
    useState('');
  const [createCustomerEmailInput, setCreateCustomerEmailInput] = useState('');
  const [isCreateCustomerModalOpen, setIsCreateCustomerModalOpen] =
    useState(false);
  const [customerMessage, setCustomerMessage] = useState('');
  const [customerMessageTone, setCustomerMessageTone] = useState<
    'success' | 'warning'
  >('success');
  const [customerError, setCustomerError] = useState('');
  const [isCustomerSearchQueued, setIsCustomerSearchQueued] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [customerMenuRect, setCustomerMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const customerPickerRef = useRef<HTMLDivElement | null>(null);
  const customerMenuRef = useRef<HTMLDivElement | null>(null);

  const isCreatingCustomer = customerCreateFetcher.state === 'submitting';
  const shouldSearchCustomers = customerInputValue.trim().length >= 2;
  const isSearchingCustomers =
    shouldSearchCustomers &&
    (isCustomerSearchQueued || customerSearchFetcher.state !== 'idle');

  const sections: ManualSection[] = [
    {
      id: 'billing',
      title: t('manualCreate.sections.billing.title', {
        defaultValue: 'Billing',
      }),
    },
    {
      id: 'items',
      title: t('manualCreate.sections.items.title', {
        defaultValue: 'Items',
      }),
    },
    {
      id: 'delivery',
      title: t('manualCreate.sections.delivery.title', {
        defaultValue: 'Delivery',
      }),
    },
  ];

  useEffect(() => {
    setCustomerOptions((existing) =>
      mergeCustomerOptions([...existing, ...sortCustomerOptions(customers)]),
    );
  }, [customers]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const searchData = customerSearchFetcher.data;
    if (!searchData) return;
    setIsCustomerSearchQueued(false);

    if (searchData.type === 'error') {
      setCustomerError(searchData.error);
      setCustomerMessage('');
      return;
    }

    if (searchData.type !== 'search') return;

    setCustomerError('');
    setCustomerOptions((existing) =>
      mergeCustomerOptions([...existing, ...searchData.customers]),
    );

    if (searchData.warning) {
      setCustomerMessage(searchData.warning);
      setCustomerMessageTone('warning');
    } else {
      setCustomerMessage('');
    }
  }, [customerSearchFetcher.data]);

  useEffect(() => {
    const createData = customerCreateFetcher.data;
    if (!createData) return;

    if (createData.type === 'error') {
      setCustomerError(createData.error);
      setCustomerMessage('');
      return;
    }

    if (createData.type !== 'create') return;

    const createdCustomer = createData.customer;
    setCustomerError('');
    setCustomerMessage(`Created customer ${createdCustomer.displayName}.`);
    setCustomerMessageTone('success');
    setCustomerOptions((existing) =>
      mergeCustomerOptions([createdCustomer, ...existing]),
    );
    setSelectedCustomerId(createdCustomer.id);
    setCustomerInputValue(formatCustomerOption(createdCustomer));
    setCreateCustomerFirstNameInput('');
    setCreateCustomerLastNameInput('');
    setCreateCustomerEmailInput('');
    setIsCustomerDropdownOpen(false);
    setCustomerMenuRect(null);
    setIsCreateCustomerModalOpen(false);
  }, [customerCreateFetcher.data]);

  useEffect(() => {
    const query = customerInputValue.trim();
    if (query.length < 2) {
      setIsCustomerSearchQueued(false);
      return;
    }

    setIsCustomerSearchQueued(true);
    const timeout = window.setTimeout(() => {
      const formData = new FormData();
      formData.append('intent', 'search_customers');
      formData.append('query', query);
      submitCustomerSearch(formData, {method: 'post'});
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [customerInputValue, submitCustomerSearch]);

  useEffect(() => {
    if (!isCustomerDropdownOpen) return;
    updateCustomerMenuPosition(customerPickerRef, setCustomerMenuRect);

    const onWindowChange = () => {
      updateCustomerMenuPosition(customerPickerRef, setCustomerMenuRect);
    };

    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);

    return () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
    };
  }, [isCustomerDropdownOpen, customerInputValue]);

  useEffect(() => {
    if (!isCustomerDropdownOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const picker = customerPickerRef.current;
      const menu = customerMenuRef.current;
      const target = event.target as Node | null;
      const path =
        typeof event.composedPath === 'function' ? event.composedPath() : [];
      const insidePicker = picker
        ? path.includes(picker) || (target ? picker.contains(target) : false)
        : false;
      const insideMenu = menu
        ? path.includes(menu) || (target ? menu.contains(target) : false)
        : false;

      if (insidePicker || insideMenu) {
        return;
      }

      setIsCustomerDropdownOpen(false);
      setCustomerMenuRect(null);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [isCustomerDropdownOpen]);

  const filteredCustomers = useMemo(() => {
    const query = customerInputValue.trim().toLowerCase();
    const list = sortCustomerOptions(customerOptions);

    if (!query) {
      return list.slice(0, 50);
    }

    return list
      .filter((customer) => {
        const name = customer.displayName.toLowerCase();
        const email = customer.email.toLowerCase();
        return name.includes(query) || email.includes(query);
      })
      .slice(0, 50);
  }, [customerInputValue, customerOptions]);

  const selectedCustomer = useMemo(
    () =>
      customerOptions.find((customer) => customer.id === selectedCustomerId) ??
      null,
    [customerOptions, selectedCustomerId],
  );
  const shippingAddressLines = useMemo(
    () => getAddressLines(selectedCustomer?.shippingAddress),
    [selectedCustomer?.shippingAddress],
  );
  const billingAddressLines = useMemo(
    () => getAddressLines(selectedCustomer?.billingAddress),
    [selectedCustomer?.billingAddress],
  );
  const shouldShowBillingAsShipping =
    shippingAddressLines.length > 0 &&
    (billingAddressLines.length === 0 ||
      isSameAddress(selectedCustomer?.billingAddress, selectedCustomer?.shippingAddress));

  const onSelectCustomer = (customer: CustomerOption) => {
    setSelectedCustomerId(customer.id);
    setCustomerInputValue(formatCustomerOption(customer));
    setIsCustomerDropdownOpen(false);
    setCustomerMenuRect(null);
    setCustomerError('');
    setCustomerMessage('');
  };

  const onRemoveSelectedCustomer = () => {
    setSelectedCustomerId('');
    setCustomerInputValue('');
    setIsCustomerDropdownOpen(false);
    setCustomerMenuRect(null);
    setCustomerMessage('');
    setCustomerError('');
  };

  const onOpenCreateCustomerModal = () => {
    const typedValue = customerInputValue.trim();
    const extractedEmail = extractEmailCandidate(typedValue);
    setCreateCustomerFirstNameInput('');
    setCreateCustomerLastNameInput('');
    setCreateCustomerEmailInput(extractedEmail);
    setCustomerError('');
    setCustomerMessage('');
    setIsCustomerDropdownOpen(false);
    setCustomerMenuRect(null);
    setIsCreateCustomerModalOpen(true);
  };

  const onCreateCustomerFromModal = () => {
    if (isCreatingCustomer) return;

    const email = createCustomerEmailInput.trim();
    if (!email) {
      setCustomerError('Email is required to create a customer.');
      setCustomerMessage('');
      return;
    }

    const formData = new FormData();
    formData.append('intent', 'create_customer');
    formData.append('email', email);
    formData.append('firstName', createCustomerFirstNameInput.trim());
    formData.append('lastName', createCustomerLastNameInput.trim());
    customerCreateFetcher.submit(formData, {method: 'post'});
  };

  const onCustomerFieldInput = (value: string) => {
    const query = value.trim();
    setCustomerInputValue(value);
    setIsCustomerSearchQueued(query.length >= 2);

    if (query.length === 0) {
      setIsCustomerDropdownOpen(false);
      setCustomerMenuRect(null);
    } else {
      setIsCustomerDropdownOpen(true);
      updateCustomerMenuPosition(customerPickerRef, setCustomerMenuRect);
    }

    setCustomerError('');
    setCustomerMessage('');

    if (selectedCustomerId) {
      const selected = customerOptions.find(
        (customer) => customer.id === selectedCustomerId,
      );
      if (!selected || formatCustomerOption(selected) !== value) {
        setSelectedCustomerId('');
      }
    }
  };

  const onCustomerFieldFocus = () => {
    setIsCustomerDropdownOpen(true);
    updateCustomerMenuPosition(customerPickerRef, setCustomerMenuRect);
  };

  const openNoteModal = () => {
    setNoteDraftText(note ?? '');
    setIsNoteModalOpen(true);
  };

  const closeNoteModal = () => {
    setIsNoteModalOpen(false);
    setNoteDraftText(note ?? '');
  };

  const saveNote = () => {
    if (noteDraftText.trim() === '') {
      return;
    }

    setNote(noteDraftText);
    setIsNoteModalOpen(false);
  };

  return (
    <Page
      title={t('manualCreate.page.title', {
        defaultValue: 'Add subscription manually',
      })}
      backAction={{
        content: t('page.title'),
        url: '/app',
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="300">
            {sections.map((section) => (
              <Card key={section.id}>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd" fontWeight="semibold">
                    {section.title}
                  </Text>
                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <BlockStack gap="300">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd" fontWeight="semibold">
                    {t('manualCreate.notes.title', {
                      defaultValue: 'Notes',
                    })}
                  </Text>
                  <Button
                    variant="plain"
                    icon={EditIcon}
                    submit={false}
                    accessibilityLabel={t('manualCreate.notes.edit', {
                      defaultValue: 'Edit note',
                    })}
                    onClick={openNoteModal}
                  />
                </InlineStack>
                {note ? (
                  <Text as="p" style={{whiteSpace: 'pre-wrap'}}>
                    {note}
                  </Text>
                ) : (
                  <Text as="p" tone="subdued">
                    {t('manualCreate.notes.empty', {
                      defaultValue: 'No notes',
                    })}
                  </Text>
                )}
                <input
                  type="hidden"
                  name="manualSubscriptionNotes"
                  value={note ?? ''}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd" fontWeight="semibold">
                    {t('manualCreate.sections.customer.title', {
                      defaultValue: 'Customer',
                    })}
                  </Text>
                  {selectedCustomer ? (
                    <Button
                      variant="plain"
                      icon={XIcon}
                      accessibilityLabel={t(
                        'manualCreate.sections.customer.remove',
                        {
                          defaultValue: 'Remove customer',
                        },
                      )}
                      onClick={onRemoveSelectedCustomer}
                    />
                  ) : null}
                </InlineStack>
                {customerLoadWarning ? (
                  <Banner tone="warning">{customerLoadWarning}</Banner>
                ) : null}
                {customerError ? (
                  <Banner tone="critical">{customerError}</Banner>
                ) : null}
                {customerMessage ? (
                  <Banner tone={customerMessageTone}>{customerMessage}</Banner>
                ) : null}
                {!selectedCustomer ? (
                  <div ref={customerPickerRef}>
                    <PolarisTextField
                      label={t('manualCreate.sections.customer.searchLabel', {
                        defaultValue: 'Search or create a customer',
                      })}
                      labelHidden
                      id="customerPicker"
                      name="customerPicker"
                      placeholder={t(
                        'manualCreate.sections.customer.searchPlaceholder',
                        {
                          defaultValue: 'Search or create a customer',
                        },
                      )}
                      prefix={<Icon source={SearchIcon} />}
                      autoComplete="off"
                      value={customerInputValue}
                      onChange={onCustomerFieldInput}
                      onFocus={onCustomerFieldFocus}
                      onKeyDown={(event) => {
                        const key = event.key;

                        if (key === 'ArrowDown' && !isCustomerDropdownOpen) {
                          event.preventDefault();
                          setIsCustomerDropdownOpen(true);
                          updateCustomerMenuPosition(
                            customerPickerRef,
                            setCustomerMenuRect,
                          );
                          return;
                        }

                        if (key === 'Enter' && isCustomerDropdownOpen) {
                          event.preventDefault();
                          const firstResult = filteredCustomers[0];
                          if (firstResult) onSelectCustomer(firstResult);
                          return;
                        }

                        if (key === 'Escape' && isCustomerDropdownOpen) {
                          event.preventDefault();
                          setIsCustomerDropdownOpen(false);
                          setCustomerMenuRect(null);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <Link
                        removeUnderline
                        target="_parent"
                        url={`shopify:admin/customers/${selectedCustomer.legacyResourceId || safeParseGid(selectedCustomer.id)}`}
                      >
                        {selectedCustomer.displayName}
                      </Link>
                      <Link
                        removeUnderline
                        target="_parent"
                        url={`shopify:admin/orders?customer_id=${selectedCustomer.legacyResourceId || safeParseGid(selectedCustomer.id)}`}
                      >
                        {formatOrderCount(selectedCustomer.numberOfOrders)}
                      </Link>
                    </BlockStack>

                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          Contact information
                        </Text>
                        <Button
                          variant="plain"
                          icon={EditIcon}
                          accessibilityLabel="Edit contact information"
                          onClick={() => {}}
                        />
                      </InlineStack>
                      <Link
                        removeUnderline
                        target="_parent"
                        url={`shopify:admin/customers/${selectedCustomer.legacyResourceId || safeParseGid(selectedCustomer.id)}`}
                      >
                        {selectedCustomer.email || 'No email'}
                      </Link>
                    </BlockStack>

                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          Shipping address
                        </Text>
                        <Button
                          variant="plain"
                          icon={EditIcon}
                          accessibilityLabel="Edit shipping address"
                          onClick={() => {}}
                        />
                      </InlineStack>
                      <BlockStack gap="0">
                        {shippingAddressLines.length > 0 ? (
                          shippingAddressLines.map((line, index) => (
                            <Text as="p" key={`shipping-${index}`}>
                              {line}
                            </Text>
                          ))
                        ) : (
                          <Text as="p" tone="subdued">
                            No shipping address
                          </Text>
                        )}
                      </BlockStack>
                    </BlockStack>

                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h3" variant="headingSm">
                          Billing address
                        </Text>
                        <Button
                          variant="plain"
                          icon={EditIcon}
                          accessibilityLabel="Edit billing address"
                          onClick={() => {}}
                        />
                      </InlineStack>
                      {shouldShowBillingAsShipping ? (
                        <Text as="p" tone="subdued">
                          Same as shipping address
                        </Text>
                      ) : billingAddressLines.length === 0 ? (
                        <Text as="p" tone="subdued">
                          No billing address
                        </Text>
                      ) : (
                        <BlockStack gap="0">
                          {billingAddressLines.map((line, index) => (
                            <Text as="p" key={`billing-${index}`}>
                              {line}
                            </Text>
                          ))}
                        </BlockStack>
                      )}
                    </BlockStack>
                  </BlockStack>
                )}
                <input
                  type="hidden"
                  name="selectedCustomerId"
                  value={selectedCustomerId}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>

      {isHydrated && !selectedCustomer && isCustomerDropdownOpen && customerMenuRect
        ? createPortal(
            <div
              ref={customerMenuRef}
              style={{
                position: 'fixed',
                zIndex: 2147483647,
                top: `${customerMenuRect.top}px`,
                left: `${customerMenuRect.left}px`,
                width: `${customerMenuRect.width}px`,
                maxHeight: 'min(320px, calc(100vh - 24px))',
                overflowY: 'auto',
              }}
            >
              <Card padding="0">
                <ActionList
                  sections={[
                    {
                      items: [
                        {
                          content: t(
                            'manualCreate.sections.customer.createAction',
                            {
                              defaultValue: 'Create a new customer',
                            },
                          ),
                          icon: PlusCircleIcon,
                          onAction: onOpenCreateCustomerModal,
                        },
                      ],
                    },
                    ...(filteredCustomers.length > 0
                      ? [
                          {
                            items: filteredCustomers.map((customer) => ({
                              content: customer.displayName,
                              helpText: customer.email || 'No email',
                              onAction: () => onSelectCustomer(customer),
                            })),
                          },
                        ]
                      : []),
                  ]}
                />
                {isSearchingCustomers ? (
                  <Box padding="200">
                    <InlineStack gap="200" blockAlign="center" wrap={false}>
                      <Spinner accessibilityLabel="Searching customers" size="small" />
                      <Text as="span" tone="subdued">
                        Searching customers...
                      </Text>
                    </InlineStack>
                  </Box>
                ) : null}
                {!isSearchingCustomers && filteredCustomers.length === 0 ? (
                  <Box padding="200">
                    <Text as="p" tone="subdued">
                      No matching customers.
                    </Text>
                  </Box>
                ) : null}
              </Card>
            </div>,
            document.body,
          )
        : null}

      <PolarisModal
        open={isCreateCustomerModalOpen}
        onClose={() => setIsCreateCustomerModalOpen(false)}
        title="Create a new customer"
        primaryAction={{
          content: 'Save',
          onAction: onCreateCustomerFromModal,
          disabled: !createCustomerEmailInput.trim() || isCreatingCustomer,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsCreateCustomerModalOpen(false),
          },
        ]}
      >
        <PolarisModal.Section>
          <BlockStack gap="300">
            <InlineStack gap="300" wrap={false}>
              <div style={{flex: 1}}>
                <PolarisTextField
                  label="First name"
                  autoComplete="off"
                  value={createCustomerFirstNameInput}
                  onChange={setCreateCustomerFirstNameInput}
                />
              </div>
              <div style={{flex: 1}}>
                <PolarisTextField
                  label="Last name"
                  autoComplete="off"
                  value={createCustomerLastNameInput}
                  onChange={setCreateCustomerLastNameInput}
                />
              </div>
            </InlineStack>
            <PolarisTextField
              label="Email"
              type="email"
              autoComplete="off"
              value={createCustomerEmailInput}
              onChange={setCreateCustomerEmailInput}
            />
          </BlockStack>
        </PolarisModal.Section>
      </PolarisModal>

      <Modal open={isNoteModalOpen} onHide={closeNoteModal}>
        <Box padding="300">
          <BlockStack gap="300">
            <BlockStack gap="100">
              <STextArea
                label={t('manualCreate.notes.label', {
                  defaultValue: 'Notes',
                })}
                rows={6}
                details={t('manualCreate.notes.helper', {
                  defaultValue:
                    'To comment on a draft order or mention a staff member, use Timeline instead',
                })}
                placeholder={t('manualCreate.notes.placeholder', {
                  defaultValue: 'Add note',
                })}
                autocomplete="off"
                value={noteDraftText}
                onInput={(event: any) =>
                  setNoteDraftText(
                    String(event?.currentTarget?.value ?? '').slice(0, 5000),
                  )
                }
              />
              <InlineStack align="end">
                <Text as="p" variant="bodySm" tone="subdued">
                  {`${noteDraftText.length}/5000`}
                </Text>
              </InlineStack>
            </BlockStack>
          </BlockStack>
        </Box>
        <TitleBar
          title={t('manualCreate.notes.modalTitle', {
            defaultValue: 'Add note',
          })}
        >
          <button onClick={closeNoteModal}>
            {t('manualCreate.notes.cancel', {defaultValue: 'Cancel'})}
          </button>
          <button
            disabled={noteDraftText.trim() === ''}
            onClick={saveNote}
          >
            {t('manualCreate.notes.done', {defaultValue: 'Done'})}
          </button>
        </TitleBar>
      </Modal>
    </Page>
  );
}

async function searchCustomers(
  admin: Awaited<ReturnType<typeof authenticate.admin>>['admin'],
  formData: FormData,
): Promise<CustomerActionData> {
  const queryRaw = (formData.get('query') as string | null)?.trim() || '';
  if (queryRaw.length < 2) {
    return {
      type: 'search',
      customers: [],
      warning: 'Type at least 2 characters to search.',
    };
  }

  const escaped = escapeSearchValue(queryRaw);
  const tokenQueries = queryRaw
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const escapedPart = escapeSearchValue(part);
      return `(name:${escapedPart}* OR email:${escapedPart}*)`;
    });
  const searchQuery = [...tokenQueries, escaped].join(' OR ');

  try {
    const response = await admin.graphql(SEARCH_CUSTOMERS_QUERY, {
      variables: {query: searchQuery},
    });

    const result = (await response.json()) as {
      errors?: Array<{message: string}>;
      data?: {
        customers?: {
          edges?: Array<{
            node?: {
              id?: string;
              legacyResourceId?: string | number | null;
              displayName?: string;
              email?: string | null;
              numberOfOrders?: number;
              defaultAddress?: CustomerAddress | null;
            };
          }>;
        };
      };
    };

    if (result.errors && result.errors.length > 0) {
      return {
        type: 'error',
        error: result.errors.map((error) => error.message).join('; '),
      };
    }

    const customers: CustomerOption[] = [];
    for (const edge of result.data?.customers?.edges ?? []) {
      const node = edge.node;
      if (!node?.id) continue;
      customers.push(mapCustomerNode(node));
    }

    return {
      type: 'search',
      customers,
    };
  } catch (error) {
    return {
      type: 'error',
      error:
        error instanceof Error ? error.message : 'Failed to search customers.',
    };
  }
}

async function createCustomer(
  admin: Awaited<ReturnType<typeof authenticate.admin>>['admin'],
  formData: FormData,
): Promise<CustomerActionData> {
  const email = (formData.get('email') as string | null)?.trim() || '';
  const firstNameInput = (formData.get('firstName') as string | null)?.trim() || '';
  const lastNameInput = (formData.get('lastName') as string | null)?.trim() || '';
  const fullName = (formData.get('name') as string | null)?.trim() || '';

  if (!email) {
    return {
      type: 'error',
      error: 'Customer email is required.',
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      type: 'error',
      error: 'Customer email format is invalid.',
    };
  }

  let firstName = firstNameInput;
  let lastName = lastNameInput;

  if (!firstName && !lastName && fullName) {
    const [first, ...rest] = fullName.split(/\s+/).filter(Boolean);
    firstName = first || '';
    lastName = rest.join(' ');
  }

  try {
    const response = await admin.graphql(CUSTOMER_CREATE_MUTATION, {
      variables: {
        input: {
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
      },
    });

    const result = (await response.json()) as {
      errors?: Array<{message: string}>;
      data?: {
        customerCreate?: {
          customer?: {
            id?: string;
            displayName?: string;
            email?: string | null;
          } | null;
          userErrors?: Array<{message: string}>;
        };
      };
    };

    if (result.errors && result.errors.length > 0) {
      return {
        type: 'error',
        error: result.errors.map((error) => error.message).join('; '),
      };
    }

    const payload = result.data?.customerCreate;
    const userErrors = payload?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        type: 'error',
        error: userErrors.map((error) => error.message).join('; '),
      };
    }

    const createdCustomer = payload?.customer;
    if (!createdCustomer?.id) {
      return {
        type: 'error',
        error: 'Customer was not created.',
      };
    }

    return {
      type: 'create',
      customer: {
        id: createdCustomer.id,
        displayName:
          createdCustomer.displayName ||
          [firstName, lastName].filter(Boolean).join(' ') ||
          createdCustomer.email ||
          email,
        email: createdCustomer.email || email,
        legacyResourceId: safeParseGid(createdCustomer.id),
        numberOfOrders: 0,
        shippingAddress: null,
        billingAddress: null,
      },
    };
  } catch (error) {
    return {
      type: 'error',
      error:
        error instanceof Error ? error.message : 'Failed to create customer.',
    };
  }
}

function escapeSearchValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function mapCustomerNode(node: {
  id: string;
  legacyResourceId?: string | number | null;
  displayName?: string;
  email?: string | null;
  numberOfOrders?: number;
  defaultAddress?: CustomerAddress | null;
}): CustomerOption {
  const fallbackLegacyId = safeParseGid(node.id);

  return {
    id: node.id,
    displayName: node.displayName || node.email || 'Unnamed customer',
    email: node.email || '',
    legacyResourceId: String(node.legacyResourceId ?? fallbackLegacyId),
    numberOfOrders: node.numberOfOrders ?? 0,
    shippingAddress: normalizeAddress(node.defaultAddress),
    billingAddress: null,
  };
}

function safeParseGid(gid: string): string {
  try {
    return String(parseGid(gid));
  } catch {
    const lastSegment = gid.split('/').pop();
    return lastSegment || gid;
  }
}

function normalizeAddress(
  address: CustomerAddress | null | undefined,
): CustomerAddress | null {
  if (!address) return null;

  return {
    firstName: address.firstName || undefined,
    lastName: address.lastName || undefined,
    address1: address.address1 || undefined,
    address2: address.address2 || undefined,
    city: address.city || undefined,
    province: address.province || undefined,
    provinceCode: address.provinceCode || undefined,
    zip: address.zip || undefined,
    country: address.country || undefined,
    phone: address.phone || undefined,
  };
}

function mergeCustomerOptions(customers: CustomerOption[]): CustomerOption[] {
  const byId = new Map<string, CustomerOption>();

  for (const customer of customers) {
    if (!customer.id) continue;
    if (!byId.has(customer.id)) {
      byId.set(customer.id, customer);
    }
  }

  return sortCustomerOptions(Array.from(byId.values()));
}

function sortCustomerOptions(customers: CustomerOption[]): CustomerOption[] {
  return [...customers].sort((a, b) => {
    const aLabel = (a.displayName || a.email || '').toLowerCase();
    const bLabel = (b.displayName || b.email || '').toLowerCase();
    return aLabel.localeCompare(bLabel, 'en');
  });
}

function formatCustomerOption(customer: CustomerOption): string {
  const name = customer.displayName || customer.email || 'Unnamed customer';
  return customer.email ? `${name} (${customer.email})` : name;
}

function extractEmailCandidate(value: string): string {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : '';
}

function formatOrderCount(orderCount: number): string {
  if (orderCount === 1) {
    return '1 order';
  }

  return `${orderCount} orders`;
}

function getAddressLines(
  address: CustomerAddress | null | undefined,
): string[] {
  if (!address) return [];

  const name = [address.firstName, address.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const cityLine = [
    address.city,
    address.provinceCode || address.province,
    address.zip,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return [
    name,
    address.address1,
    address.address2,
    cityLine,
    address.country,
    address.phone,
  ].filter(Boolean) as string[];
}

function isSameAddress(
  first: CustomerAddress | null | undefined,
  second: CustomerAddress | null | undefined,
): boolean {
  if (!first || !second) {
    return false;
  }

  return (
    (first.firstName || '') === (second.firstName || '') &&
    (first.lastName || '') === (second.lastName || '') &&
    (first.address1 || '') === (second.address1 || '') &&
    (first.address2 || '') === (second.address2 || '') &&
    (first.city || '') === (second.city || '') &&
    (first.provinceCode || first.province || '') ===
      (second.provinceCode || second.province || '') &&
    (first.zip || '') === (second.zip || '') &&
    (first.country || '') === (second.country || '') &&
    (first.phone || '') === (second.phone || '')
  );
}

function updateCustomerMenuPosition(
  customerPickerRef: RefObject<HTMLDivElement>,
  setCustomerMenuRect: Dispatch<
    SetStateAction<{top: number; left: number; width: number} | null>
  >,
) {
  const anchor = customerPickerRef.current;
  if (!anchor) {
    setCustomerMenuRect(null);
    return;
  }

  const rect = anchor.getBoundingClientRect();
  const viewportPadding = 8;
  const menuMaxHeight = Math.min(320, window.innerHeight - 24);
  const width = Math.max(rect.width, 280);
  const maxLeft = Math.max(
    viewportPadding,
    window.innerWidth - width - viewportPadding,
  );
  const left = Math.min(Math.max(rect.left, viewportPadding), maxLeft);
  const shouldOpenUpwards =
    rect.bottom + 4 + menuMaxHeight > window.innerHeight - viewportPadding &&
    rect.top - 4 - menuMaxHeight > viewportPadding;
  const top = shouldOpenUpwards
    ? Math.max(viewportPadding, rect.top - menuMaxHeight - 4)
    : Math.min(
        window.innerHeight - menuMaxHeight - viewportPadding,
        rect.bottom + 4,
      );

  setCustomerMenuRect({top, left, width});
}
