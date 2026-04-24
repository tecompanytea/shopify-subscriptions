import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@remix-run/node';
import {
  Form as RemixForm,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from '@remix-run/react';
import {parseGid} from '@shopify/admin-graphql-api-utilities';
import {
  ActionList,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FormLayout,
  Icon,
  InlineGrid,
  InlineStack,
  Layout,
  Link,
  Modal as PolarisModal,
  Page,
  PageActions,
  Popover,
  Select,
  Spinner,
  Tag,
  Text,
  TextField as PolarisTextField,
  Thumbnail,
  useBreakpoints,
} from '~/components/polaris';
import {
  DiscountIcon,
  EditIcon,
  ImageIcon,
  MenuHorizontalIcon,
  PlusCircleIcon,
  SearchIcon,
  XIcon,
} from '~/components/polaris-icons';
import {createPortal} from 'react-dom';
import type {Dispatch, RefObject, SetStateAction} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {PaymentSummaryCard} from '~/components/PaymentSummaryCard/PaymentSummaryCard';
import PaymentIcon from '~/components/PaymentIcon/PaymentIcon';
import {ContractNoteModal} from '~/components/ContractNoteModal/ContractNoteModal';
import SubscriptionContractAtomicCreateMutation from '~/graphql/SubscriptionContractAtomicCreateMutation';
import {useTranslation} from 'react-i18next';
import {authenticate} from '~/shopify.server';
import {getResourcePickerSelectionImage} from '~/utils/helpers/resourcePicker';

const SDateField: any = 's-date-field';

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
  countryCode?: string;
  countryCodeV2?: string;
  phone?: string;
};

type CustomerPaymentMethodOption = {
  id: string;
  brand: string;
  lastDigits: string;
  maskedNumber: string;
  expiryMonth: number;
  expiryYear: number;
  instrumentType: 'credit_card' | 'shop_pay' | 'paypal';
  paypalEmail?: string;
};

type CustomerOption = {
  id: string;
  displayName: string;
  email: string;
  legacyResourceId: string;
  numberOfOrders: number;
  shippingAddress?: CustomerAddress | null;
  billingAddress?: CustomerAddress | null;
  paymentMethods?: CustomerPaymentMethodOption[];
};

type SelectedProduct = {
  id: string;
  title: string;
  variantTitle: string;
  variantId: string;
  productId: string;
  quantity: number;
  price: number;
  currencyCode: string;
  imageUrl?: string;
  imageAlt?: string;
  discountType?: 'FIXED_AMOUNT' | 'PERCENTAGE';
  discountValue?: number;
  discountReason?: string;
};

type DeliveryInterval = 'WEEK' | 'MONTH' | 'YEAR';

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

type CreateContractActionData = {
  type: 'create_contract_error';
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
            countryCodeV2
            phone
          }
          paymentMethods(first: 10) {
            edges {
              node {
                id
                revokedAt
                instrument {
                  __typename
                  ... on CustomerCreditCard {
                    brand
                    lastDigits
                    maskedNumber
                    expiryMonth
                    expiryYear
                  }
                  ... on CustomerShopPayAgreement {
                    lastDigits
                    maskedNumber
                    expiryMonth
                    expiryYear
                  }
                  ... on CustomerPaypalBillingAgreement {
                    paypalAccountEmail
                  }
                }
              }
            }
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
            countryCodeV2
            phone
          }
          paymentMethods(first: 10) {
            edges {
              node {
                id
                revokedAt
                instrument {
                  __typename
                  ... on CustomerCreditCard {
                    brand
                    lastDigits
                    maskedNumber
                    expiryMonth
                    expiryYear
                  }
                  ... on CustomerShopPayAgreement {
                    lastDigits
                    maskedNumber
                    expiryMonth
                    expiryYear
                  }
                  ... on CustomerPaypalBillingAgreement {
                    paypalAccountEmail
                  }
                }
              }
            }
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
      const errorMessage = result.errors
        .map((error) => error.message)
        .join('; ');
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

  if (intent === 'create_contract') {
    const result = await createSubscriptionContract(admin, formData);

    if ('error' in result) {
      return json<CreateContractActionData>(
        {
          type: 'create_contract_error',
          error: result.error,
        },
        {status: 400},
      );
    }

    return redirect(`/app/contracts/${safeParseGid(result.contractId)}`);
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
  const {smDown: isMobile} = useBreakpoints();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
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
  const [isEditEmailModalOpen, setIsEditEmailModalOpen] = useState(false);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [isEditShippingModalOpen, setIsEditShippingModalOpen] = useState(false);
  const [editShippingAddress, setEditShippingAddress] =
    useState<CustomerAddress>({});
  const [isEditBillingModalOpen, setIsEditBillingModalOpen] = useState(false);
  const [editBillingAddress, setEditBillingAddress] = useState<CustomerAddress>(
    {},
  );
  const [isPaymentMethodsModalOpen, setIsPaymentMethodsModalOpen] =
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

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    [],
  );
  const [discountModalVariantId, setDiscountModalVariantId] = useState<
    string | null
  >(null);
  const [discountDraftType, setDiscountDraftType] = useState<
    'FIXED_AMOUNT' | 'PERCENTAGE'
  >('FIXED_AMOUNT');
  const [discountDraftValue, setDiscountDraftValue] = useState('');
  const [discountDraftReason, setDiscountDraftReason] = useState('');
  const [deliveryIntervalCount, setDeliveryIntervalCount] = useState('4');
  const [deliveryInterval, setDeliveryInterval] =
    useState<DeliveryInterval>('WEEK');
  const [chargeCustomerDate, setChargeCustomerDate] = useState(() =>
    getIsoDateFromDate(new Date()),
  );
  const customerConsentErrorMessage = t(
    'manualCreate.paymentSummary.customerConsent.error',
    {
      defaultValue: 'You must confirm customer consent to continue.',
    },
  );
  const [hasCustomerConsent, setHasCustomerConsent] = useState(false);

  const isCreatingCustomer = customerCreateFetcher.state === 'submitting';
  const shouldSearchCustomers = customerInputValue.trim().length >= 2;
  const isSearchingCustomers =
    shouldSearchCustomers &&
    (isCustomerSearchQueued || customerSearchFetcher.state !== 'idle');

  const selectedItemsForProductPicker = selectedProducts
    .filter((p) => Boolean(p.productId))
    .map((p) => ({
      id: p.productId,
      ...(p.variantId && {variants: [{id: p.variantId}]}),
    }));

  const deliveryIntervalOptions = [
    {
      label: t('edit.details.deliveryInterval.weeks', {
        defaultValue: 'weeks',
      }),
      value: 'WEEK',
    },
    {
      label: t('edit.details.deliveryInterval.months', {
        defaultValue: 'months',
      }),
      value: 'MONTH',
    },
    {
      label: t('edit.details.deliveryInterval.years', {
        defaultValue: 'years',
      }),
      value: 'YEAR',
    },
  ];

  const onChargeCustomerDateChange = useCallback((event: any) => {
    const nextValue = String(
      event?.detail?.value ?? event?.currentTarget?.value ?? '',
    ).trim();

    if (nextValue) {
      setChargeCustomerDate(nextValue);
    }
  }, []);

  const paymentSummaryCurrencyCode = selectedProducts[0]?.currencyCode ?? 'USD';
  const paymentSummarySubtotal = selectedProducts.reduce(
    (sum, product) => sum + product.quantity * getDiscountedPrice(product),
    0,
  );
  const paymentSummaryTax = 0;
  const paymentSummaryTotal = paymentSummarySubtotal + paymentSummaryTax;

  async function openProductPicker(searchQuery?: string) {
    const selectedItems = await window.shopify.resourcePicker({
      selectionIds: selectedItemsForProductPicker,
      multiple: true,
      query: searchQuery,
      type: 'product',
      action: 'select',
      filter: {
        query: 'bundles:false',
      },
    });

    if (!selectedItems) {
      return;
    }

    const currentVariantIds = new Set(selectedProducts.map((p) => p.variantId));
    const newProducts: SelectedProduct[] = [];

    selectedItems.forEach((item: any) => {
      if ('variants' in item) {
        item.variants.forEach((variant: any) => {
          if (variant.id && !currentVariantIds.has(variant.id)) {
            const image = getResourcePickerSelectionImage(item, variant);

            newProducts.push({
              id: `${item.id}-${variant.id}`,
              title: item.title,
              variantTitle: variant.title ?? '',
              variantId: variant.id,
              productId: item.id,
              quantity: 1,
              price: Number(variant.price ?? '0.00'),
              currencyCode: 'USD',
              imageUrl: image?.url,
              imageAlt: image?.altText,
            });
          }
        });
      }
    });

    // Keep only products whose variants are still in the selection
    const selectionVariantIds = new Set<string>();
    selectedItems.forEach((item: any) => {
      if ('variants' in item) {
        item.variants.forEach((variant: any) => {
          if (variant.id) selectionVariantIds.add(variant.id);
        });
      }
    });

    setSelectedProducts((prev) =>
      [...prev, ...newProducts].filter((p) =>
        selectionVariantIds.has(p.variantId),
      ),
    );
  }

  function removeProduct(variantId: string) {
    setSelectedProducts((prev) =>
      prev.filter((p) => p.variantId !== variantId),
    );
  }

  function updateProductQuantity(variantId: string, quantity: number) {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.variantId === variantId ? {...p, quantity: Math.max(1, quantity)} : p,
      ),
    );
  }

  function formatPrice(amount: number, currencyCode: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  }

  function openDiscountModal(variantId: string) {
    const product = selectedProducts.find((p) => p.variantId === variantId);
    if (!product) return;
    setDiscountModalVariantId(variantId);
    setDiscountDraftType(product.discountType ?? 'FIXED_AMOUNT');
    setDiscountDraftValue(
      product.discountValue != null ? String(product.discountValue) : '',
    );
    setDiscountDraftReason(product.discountReason ?? '');
  }

  function applyDiscount() {
    if (!discountModalVariantId) return;
    const value = parseFloat(discountDraftValue) || 0;
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.variantId === discountModalVariantId
          ? {
              ...p,
              discountType: discountDraftType,
              discountValue: value > 0 ? value : undefined,
              discountReason: discountDraftReason || undefined,
            }
          : p,
      ),
    );
    setDiscountModalVariantId(null);
  }

  function getDiscountedPrice(product: SelectedProduct): number {
    if (!product.discountValue || product.discountValue <= 0)
      return product.price;
    if (product.discountType === 'PERCENTAGE') {
      return product.price * (1 - product.discountValue / 100);
    }
    return Math.max(0, product.price - product.discountValue);
  }

  function removeDiscount(variantId: string) {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.variantId === variantId
          ? {
              ...p,
              discountType: undefined,
              discountValue: undefined,
              discountReason: undefined,
            }
          : p,
      ),
    );
    setDiscountModalVariantId(null);
  }

  function getDiscountLabel(product: SelectedProduct): string | null {
    if (!product.discountValue || product.discountValue <= 0) return null;
    if (product.discountType === 'PERCENTAGE') {
      return `Custom discount (-${product.discountValue}%)`;
    }
    const formatted = formatPrice(product.discountValue, product.currencyCode);
    return `Custom discount (-${formatted} ${product.currencyCode})`;
  }

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
  const isCustomerConsentEnabled =
    selectedProducts.length > 0 && selectedCustomer !== null;
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
      isSameAddress(
        selectedCustomer?.billingAddress,
        selectedCustomer?.shippingAddress,
      ));
  const paymentMethodCount = selectedCustomer?.paymentMethods?.length ?? 0;
  const deliveryIntervalCountValue = Number.parseInt(deliveryIntervalCount, 10);
  const createContractError =
    actionData &&
    'type' in actionData &&
    actionData.type === 'create_contract_error'
      ? actionData.error
      : '';
  const isSavingContract =
    navigation.state !== 'idle' &&
    navigation.formData?.get('intent') === 'create_contract';
  const canSaveContract =
    selectedProducts.length > 0 &&
    selectedCustomer !== null &&
    hasCustomerConsent &&
    Number.isInteger(deliveryIntervalCountValue) &&
    deliveryIntervalCountValue >= 1 &&
    Boolean(chargeCustomerDate);

  useEffect(() => {
    if (!isCustomerConsentEnabled && hasCustomerConsent) {
      setHasCustomerConsent(false);
    }
  }, [hasCustomerConsent, isCustomerConsentEnabled]);

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
    setNote(noteDraftText.trim() === '' ? null : noteDraftText);
    setIsNoteModalOpen(false);
  };

  const updateSelectedCustomer = (updates: Partial<CustomerOption>) => {
    if (!selectedCustomerId) return;
    setCustomerOptions((prev) =>
      prev.map((c) => (c.id === selectedCustomerId ? {...c, ...updates} : c)),
    );
  };

  const openEditEmailModal = () => {
    if (!selectedCustomer) return;
    setEditEmailValue(selectedCustomer.email || '');
    setIsEditEmailModalOpen(true);
  };

  const saveEditEmail = () => {
    updateSelectedCustomer({email: editEmailValue.trim()});
    setIsEditEmailModalOpen(false);
  };

  const openEditShippingModal = () => {
    if (!selectedCustomer) return;
    const fallbackName = getCustomerNameParts(selectedCustomer);
    const existingShippingAddress = selectedCustomer.shippingAddress || {};
    setEditShippingAddress({
      ...fallbackName,
      ...existingShippingAddress,
      firstName: existingShippingAddress.firstName || fallbackName.firstName,
      lastName: existingShippingAddress.lastName || fallbackName.lastName,
    });
    setIsEditShippingModalOpen(true);
  };

  const saveEditShipping = () => {
    updateSelectedCustomer({
      shippingAddress: withAddressDefaults(editShippingAddress),
    });
    setIsEditShippingModalOpen(false);
  };

  const openEditBillingModal = () => {
    if (!selectedCustomer) return;
    const fallbackName = getCustomerNameParts(selectedCustomer);
    const existingBillingAddress = selectedCustomer.billingAddress || {};
    setEditBillingAddress({
      ...fallbackName,
      ...existingBillingAddress,
      firstName: existingBillingAddress.firstName || fallbackName.firstName,
      lastName: existingBillingAddress.lastName || fallbackName.lastName,
    });
    setIsEditBillingModalOpen(true);
  };

  const saveEditBilling = () => {
    updateSelectedCustomer({
      billingAddress: withAddressDefaults(editBillingAddress),
    });
    setIsEditBillingModalOpen(false);
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
      <RemixForm method="post">
        <input type="hidden" name="intent" value="create_contract" />
        <input
          type="hidden"
          name="selectedProductsPayload"
          value={JSON.stringify(selectedProducts)}
        />
        <input
          type="hidden"
          name="selectedCustomerPayload"
          value={selectedCustomer ? JSON.stringify(selectedCustomer) : ''}
        />
        <input
          type="hidden"
          name="chargeCustomerDate"
          value={chargeCustomerDate}
        />
        {createContractError ? (
          <Box paddingBlockEnd="300">
            <Banner tone="critical">{createContractError}</Banner>
          </Box>
        ) : null}
        <Layout>
          <Layout.Section>
            <BlockStack gap="300">
              <div style={{position: 'relative', zIndex: 2}}>
                <Card>
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd" fontWeight="semibold">
                      {t('manualCreate.sections.products.title', {
                        defaultValue: 'Products',
                      })}
                    </Text>
                    <InlineStack gap="200" align="start">
                      <div style={{flexGrow: 1}}>
                        <PolarisTextField
                          prefix={<Icon source={SearchIcon} />}
                          type="search"
                          autoComplete="off"
                          label={t(
                            'manualCreate.sections.products.searchLabel',
                            {
                              defaultValue: 'Search products',
                            },
                          )}
                          labelHidden
                          id="productSearch"
                          name="productSearch"
                          placeholder={t(
                            'manualCreate.sections.products.searchPlaceholder',
                            {
                              defaultValue: 'Search products',
                            },
                          )}
                          value=""
                          onChange={(value) => {
                            if (value.length > 0) {
                              openProductPicker(value);
                            }
                          }}
                        />
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => openProductPicker()}
                      >
                        {t('manualCreate.sections.products.browse', {
                          defaultValue: 'Browse',
                        })}
                      </Button>
                    </InlineStack>
                    {selectedProducts.length > 0 && (
                      <BlockStack gap="0">
                        {/* Table header */}
                        <Box paddingBlockEnd="300">
                          <InlineStack
                            align="space-between"
                            blockAlign="center"
                            wrap={false}
                          >
                            <Box width="50%">
                              <Text
                                as="span"
                                variant="headingSm"
                                fontWeight="medium"
                                tone="subdued"
                              >
                                {t(
                                  'manualCreate.sections.products.columnProduct',
                                  {defaultValue: 'Product'},
                                )}
                              </Text>
                            </Box>
                            <Box width="90px">
                              <Text
                                as="span"
                                variant="headingSm"
                                fontWeight="medium"
                                tone="subdued"
                              >
                                {t(
                                  'manualCreate.sections.products.columnQuantity',
                                  {defaultValue: 'Quantity'},
                                )}
                              </Text>
                            </Box>
                            <Box width="80px">
                              <Text
                                as="span"
                                variant="headingSm"
                                fontWeight="medium"
                                tone="subdued"
                                alignment="end"
                              >
                                {t(
                                  'manualCreate.sections.products.columnTotal',
                                  {
                                    defaultValue: 'Total',
                                  },
                                )}
                              </Text>
                            </Box>
                            <Box width="36px" />
                          </InlineStack>
                        </Box>
                        {/* Product rows */}
                        {selectedProducts.map((product, index) => {
                          const discountedPrice = getDiscountedPrice(product);
                          const hasDiscount =
                            product.discountValue != null &&
                            product.discountValue > 0;
                          const discountLabel = getDiscountLabel(product);
                          return (
                            <div key={product.variantId}>
                              <Divider />
                              <Box paddingBlock="300">
                                <InlineStack
                                  align="space-between"
                                  blockAlign="start"
                                  wrap={false}
                                  gap="300"
                                >
                                  {/* Product info */}
                                  <Box width="50%">
                                    <InlineStack
                                      gap="300"
                                      align="start"
                                      blockAlign="start"
                                      wrap={false}
                                    >
                                      <Thumbnail
                                        source={product.imageUrl || ImageIcon}
                                        alt={product.imageAlt || product.title}
                                        size="small"
                                      />
                                      <BlockStack gap="100">
                                        <Text as="span" variant="bodyMd">
                                          {product.title}
                                        </Text>
                                        {product.variantTitle &&
                                          product.variantTitle !==
                                            'Default Title' && (
                                            <div>
                                              <Tag>{product.variantTitle}</Tag>
                                            </div>
                                          )}
                                        <InlineStack
                                          blockAlign="center"
                                          gap="100"
                                          wrap={true}
                                        >
                                          <Button
                                            variant="plain"
                                            onClick={() =>
                                              openDiscountModal(
                                                product.variantId,
                                              )
                                            }
                                            accessibilityLabel={
                                              hasDiscount
                                                ? `Unit price ${formatPrice(discountedPrice, product.currencyCode)}, edit discount`
                                                : `Unit price ${formatPrice(product.price, product.currencyCode)}, add discount`
                                            }
                                          >
                                            {formatPrice(
                                              discountedPrice,
                                              product.currencyCode,
                                            )}
                                          </Button>
                                          {hasDiscount && (
                                            <Text
                                              as="span"
                                              variant="bodyMd"
                                              tone="subdued"
                                              textDecorationLine="line-through"
                                            >
                                              {formatPrice(
                                                product.price,
                                                product.currencyCode,
                                              )}
                                            </Text>
                                          )}
                                        </InlineStack>
                                        {discountLabel && (
                                          <InlineStack
                                            gap="100"
                                            blockAlign="center"
                                            wrap={false}
                                          >
                                            <Icon
                                              source={DiscountIcon}
                                              tone="subdued"
                                            />
                                            <Text
                                              as="span"
                                              variant="bodySm"
                                              tone="subdued"
                                            >
                                              {discountLabel}
                                            </Text>
                                          </InlineStack>
                                        )}
                                      </BlockStack>
                                    </InlineStack>
                                  </Box>
                                  {/* Quantity */}
                                  <Box width="90px">
                                    <PolarisTextField
                                      type="number"
                                      label="Quantity"
                                      labelHidden
                                      autoComplete="off"
                                      value={String(product.quantity)}
                                      min={1}
                                      onChange={(value) =>
                                        updateProductQuantity(
                                          product.variantId,
                                          parseInt(value, 10) || 1,
                                        )
                                      }
                                    />
                                  </Box>
                                  {/* Total */}
                                  <Box width="80px">
                                    <Text
                                      as="span"
                                      variant="bodyMd"
                                      alignment="end"
                                    >
                                      {formatPrice(
                                        product.quantity * discountedPrice,
                                        product.currencyCode,
                                      )}
                                    </Text>
                                  </Box>
                                  {/* Remove */}
                                  <Box width="36px">
                                    <Button
                                      variant="tertiary"
                                      icon={XIcon}
                                      accessibilityLabel={t(
                                        'manualCreate.sections.products.remove',
                                        {
                                          defaultValue: 'Remove product',
                                        },
                                      )}
                                      onClick={() =>
                                        removeProduct(product.variantId)
                                      }
                                    />
                                  </Box>
                                </InlineStack>
                              </Box>
                              {/* Hidden form inputs */}
                              <input
                                type="hidden"
                                name={`selectedProducts[${index}].variantId`}
                                value={product.variantId}
                              />
                              <input
                                type="hidden"
                                name={`selectedProducts[${index}].quantity`}
                                value={product.quantity}
                              />
                              <input
                                type="hidden"
                                name={`selectedProducts[${index}].price`}
                                value={discountedPrice}
                              />
                            </div>
                          );
                        })}
                        <Divider />
                        <Box paddingBlockStart="300" paddingBlockEnd="300">
                          <BlockStack gap="200">
                            <Text as="h3" variant="bodySm" fontWeight="medium">
                              {t('edit.details.deliveryFrequency.title', {
                                defaultValue: 'Delivery frequency',
                              })}
                            </Text>
                            <InlineStack gap="150" wrap>
                              <Box maxWidth={!isMobile ? '6rem' : undefined}>
                                <PolarisTextField
                                  label={t(
                                    'edit.details.deliveryFrequency.intervalCount',
                                    {
                                      defaultValue: 'Interval count',
                                    },
                                  )}
                                  labelHidden
                                  name="deliveryPolicy.intervalCount"
                                  id="deliveryPolicy.intervalCount"
                                  type="number"
                                  autoComplete="off"
                                  min={1}
                                  value={deliveryIntervalCount}
                                  onChange={setDeliveryIntervalCount}
                                />
                              </Box>
                              <Select
                                label={t(
                                  'edit.details.deliveryFrequency.interval',
                                  {
                                    defaultValue: 'Interval',
                                  },
                                )}
                                labelHidden
                                name="deliveryPolicy.interval"
                                id="deliveryPolicy.interval"
                                options={deliveryIntervalOptions}
                                value={deliveryInterval}
                                onChange={(value) =>
                                  setDeliveryInterval(value as DeliveryInterval)
                                }
                              />
                            </InlineStack>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              {t('edit.details.deliveryFrequency.warning', {
                                defaultValue:
                                  'Updating the delivery frequency will automatically update the billing frequency.',
                              })}
                            </Text>
                          </BlockStack>
                        </Box>
                        <Divider />
                        <Box paddingBlockStart="300">
                          <BlockStack gap="200">
                            <Text as="h3" variant="bodySm" fontWeight="medium">
                              {t(
                                'manualCreate.sections.products.chargeDate.title',
                                {
                                  defaultValue: 'Next billing date',
                                },
                              )}
                            </Text>
                            <div style={{position: 'relative', zIndex: 40}}>
                              <SDateField
                                label={t(
                                  'manualCreate.sections.products.chargeDate.fieldLabel',
                                  {
                                    defaultValue: 'Next billing date',
                                  },
                                )}
                                labelAccessibilityVisibility="exclusive"
                                name="deliveryDate"
                                disallowDays="[0, 6]"
                                value={chargeCustomerDate}
                                onInput={onChargeCustomerDateChange}
                                onChange={onChargeCustomerDateChange}
                              />
                            </div>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              {t(
                                'manualCreate.sections.products.chargeDate.note',
                                {
                                  defaultValue:
                                    'Customer will get billed at 8:00 EST on this date.',
                                },
                              )}
                            </Text>
                          </BlockStack>
                        </Box>
                      </BlockStack>
                    )}
                    {/* Discount modal */}
                    {(() => {
                      const discountModalProduct = discountModalVariantId
                        ? selectedProducts.find(
                            (p) => p.variantId === discountModalVariantId,
                          )
                        : null;
                      const hasExistingDiscount =
                        discountModalProduct?.discountValue != null &&
                        discountModalProduct.discountValue > 0;
                      return (
                        <PolarisModal
                          open={discountModalVariantId !== null}
                          onClose={() => setDiscountModalVariantId(null)}
                          title={t(
                            'manualCreate.sections.products.discountModal.title',
                            {
                              defaultValue: 'Add discount',
                            },
                          )}
                          primaryAction={{
                            content: t(
                              'manualCreate.sections.products.discountModal.done',
                              {
                                defaultValue: 'Done',
                              },
                            ),
                            onAction: applyDiscount,
                            disabled:
                              !discountDraftValue ||
                              parseFloat(discountDraftValue) <= 0,
                          }}
                          secondaryActions={[
                            {
                              content: t(
                                'manualCreate.sections.products.discountModal.cancel',
                                {
                                  defaultValue: 'Cancel',
                                },
                              ),
                              onAction: () => setDiscountModalVariantId(null),
                            },
                          ]}
                          footer={
                            hasExistingDiscount ? (
                              <Button
                                variant="primary"
                                tone="critical"
                                onClick={() =>
                                  removeDiscount(discountModalVariantId!)
                                }
                                accessibilityLabel={t(
                                  'manualCreate.sections.products.discountModal.remove',
                                  {
                                    defaultValue: 'Remove discount',
                                  },
                                )}
                              >
                                {t(
                                  'manualCreate.sections.products.discountModal.remove',
                                  {
                                    defaultValue: 'Remove discount',
                                  },
                                )}
                              </Button>
                            ) : undefined
                          }
                        >
                          <PolarisModal.Section>
                            <BlockStack gap="400">
                              <FormLayout>
                                <FormLayout.Group>
                                  <Select
                                    label={t(
                                      'manualCreate.sections.products.discountModal.typeLabel',
                                      {
                                        defaultValue: 'Discount type',
                                      },
                                    )}
                                    options={[
                                      {label: 'Amount', value: 'FIXED_AMOUNT'},
                                      {
                                        label: 'Percentage',
                                        value: 'PERCENTAGE',
                                      },
                                    ]}
                                    value={discountDraftType}
                                    onChange={(value) =>
                                      setDiscountDraftType(
                                        value as 'FIXED_AMOUNT' | 'PERCENTAGE',
                                      )
                                    }
                                  />
                                  <PolarisTextField
                                    label={t(
                                      'manualCreate.sections.products.discountModal.valueLabel',
                                      {
                                        defaultValue: 'Value (per unit)',
                                      },
                                    )}
                                    type="number"
                                    autoComplete="off"
                                    value={discountDraftValue}
                                    onChange={setDiscountDraftValue}
                                    prefix={
                                      discountDraftType === 'FIXED_AMOUNT'
                                        ? '$'
                                        : undefined
                                    }
                                    suffix={
                                      discountDraftType === 'PERCENTAGE'
                                        ? '%'
                                        : 'USD'
                                    }
                                    placeholder="0.00"
                                  />
                                </FormLayout.Group>
                                <PolarisTextField
                                  label={t(
                                    'manualCreate.sections.products.discountModal.reasonLabel',
                                    {
                                      defaultValue: 'Reason for discount',
                                    },
                                  )}
                                  autoComplete="off"
                                  value={discountDraftReason}
                                  onChange={setDiscountDraftReason}
                                  helpText={t(
                                    'manualCreate.sections.products.discountModal.reasonHelp',
                                    {
                                      defaultValue: 'Visible to customer',
                                    },
                                  )}
                                />
                              </FormLayout>
                            </BlockStack>
                          </PolarisModal.Section>
                        </PolarisModal>
                      );
                    })()}
                  </BlockStack>
                </Card>
              </div>
              {selectedProducts.length > 0 ? (
                <>
                  <PaymentSummaryCard
                    subtotal={{
                      amount: paymentSummarySubtotal,
                      currencyCode: paymentSummaryCurrencyCode,
                    }}
                    totalTax={{
                      amount: paymentSummaryTax,
                      currencyCode: paymentSummaryCurrencyCode,
                    }}
                    total={{
                      amount: paymentSummaryTotal,
                      currencyCode: paymentSummaryCurrencyCode,
                    }}
                  />
                  <Card>
                    <BlockStack gap="200">
                      <Checkbox
                        label={t(
                          'manualCreate.paymentSummary.customerConsent.label',
                          {
                            defaultValue:
                              'I confirm the customer agrees to this subscription and authorizes automatic charges to their credit card on the selected billing date and subscription schedule.',
                          },
                        )}
                        disabled={!isCustomerConsentEnabled}
                        checked={hasCustomerConsent}
                        error={
                          isCustomerConsentEnabled && !hasCustomerConsent
                            ? customerConsentErrorMessage
                            : undefined
                        }
                        onChange={setHasCustomerConsent}
                      />
                      <input
                        type="hidden"
                        name="customerConsentAccepted"
                        value={
                          isCustomerConsentEnabled && hasCustomerConsent
                            ? 'true'
                            : 'false'
                        }
                      />
                    </BlockStack>
                  </Card>
                </>
              ) : null}
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
                    <Banner tone={customerMessageTone}>
                      {customerMessage}
                    </Banner>
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
                            onClick={openEditEmailModal}
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
                            onClick={openEditShippingModal}
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
                            onClick={openEditBillingModal}
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

                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="h3" variant="headingSm">
                            Payment methods
                          </Text>
                          <Button
                            variant="plain"
                            icon={EditIcon}
                            accessibilityLabel="Manage payment methods"
                            onClick={() => setIsPaymentMethodsModalOpen(true)}
                          />
                        </InlineStack>
                        <Text
                          as="p"
                          tone={paymentMethodCount > 0 ? undefined : 'subdued'}
                        >
                          {paymentMethodCount > 0
                            ? `${paymentMethodCount} saved card${paymentMethodCount === 1 ? '' : 's'}`
                            : 'No saved cards'}
                        </Text>
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
        <PageActions
          primaryAction={
            <Button
              variant="primary"
              submit
              loading={isSavingContract}
              disabled={!canSaveContract}
            >
              {t('actions.saveButtonText', {
                ns: 'common',
                defaultValue: 'Save',
              })}
            </Button>
          }
        />
      </RemixForm>

      {isHydrated &&
      !selectedCustomer &&
      isCustomerDropdownOpen &&
      customerMenuRect
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
                      <Spinner
                        accessibilityLabel="Searching customers"
                        size="small"
                      />
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

      <PolarisModal
        open={isEditEmailModalOpen}
        onClose={() => setIsEditEmailModalOpen(false)}
        title="Edit contact information"
        primaryAction={{
          content: 'Done',
          onAction: saveEditEmail,
          disabled: !editEmailValue.trim() || !editEmailValue.includes('@'),
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsEditEmailModalOpen(false),
          },
        ]}
      >
        <PolarisModal.Section>
          <BlockStack gap="300">
            <PolarisTextField
              label="Email"
              type="email"
              autoComplete="off"
              value={editEmailValue}
              onChange={setEditEmailValue}
            />
            <Checkbox label="Update customer profile" checked disabled />
          </BlockStack>
        </PolarisModal.Section>
      </PolarisModal>

      <PolarisModal
        open={isEditShippingModalOpen}
        onClose={() => setIsEditShippingModalOpen(false)}
        title="Edit shipping address"
        primaryAction={{
          content: 'Done',
          onAction: saveEditShipping,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsEditShippingModalOpen(false),
          },
        ]}
      >
        <PolarisModal.Section>
          <AddressForm
            address={editShippingAddress}
            onChange={setEditShippingAddress}
          />
        </PolarisModal.Section>
      </PolarisModal>

      <PolarisModal
        open={isEditBillingModalOpen}
        onClose={() => setIsEditBillingModalOpen(false)}
        title="Edit billing address"
        primaryAction={{
          content: 'Done',
          onAction: saveEditBilling,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsEditBillingModalOpen(false),
          },
        ]}
      >
        <PolarisModal.Section>
          <AddressForm
            address={editBillingAddress}
            onChange={setEditBillingAddress}
          />
        </PolarisModal.Section>
      </PolarisModal>

      <PolarisModal
        open={isPaymentMethodsModalOpen}
        onClose={() => setIsPaymentMethodsModalOpen(false)}
        title="Manage payment methods"
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => setIsPaymentMethodsModalOpen(false),
          },
        ]}
      >
        {(selectedCustomer?.paymentMethods ?? []).length === 0 ? (
          <PolarisModal.Section>
            <Text as="p" tone="subdued">
              No saved payment methods
            </Text>
          </PolarisModal.Section>
        ) : (
          (selectedCustomer?.paymentMethods ?? []).map((pm) => (
            <PolarisModal.Section key={pm.id}>
              <PaymentMethodRow
                paymentMethod={pm}
                customerId={selectedCustomer!.id}
              />
            </PolarisModal.Section>
          ))
        )}
      </PolarisModal>

      <ContractNoteModal
        open={isNoteModalOpen}
        initialValue={note}
        value={noteDraftText}
        onValueChange={setNoteDraftText}
        onClose={closeNoteModal}
        onSave={saveNote}
        title={t('manualCreate.notes.modalTitle', {
          defaultValue: 'Add note',
        })}
        label={t('manualCreate.notes.label', {
          defaultValue: 'Notes',
        })}
        details={t('manualCreate.notes.helper', {
          defaultValue:
            'To comment on a draft order or mention a staff member, use Timeline instead',
        })}
        placeholder={t('manualCreate.notes.placeholder', {
          defaultValue: 'Add note',
        })}
        cancelText={t('manualCreate.notes.cancel', {defaultValue: 'Cancel'})}
        doneText={t('manualCreate.notes.done', {defaultValue: 'Done'})}
      />
    </Page>
  );
}

const US_STATES = [
  {label: 'Alabama', value: 'AL'},
  {label: 'Alaska', value: 'AK'},
  {label: 'Arizona', value: 'AZ'},
  {label: 'Arkansas', value: 'AR'},
  {label: 'California', value: 'CA'},
  {label: 'Colorado', value: 'CO'},
  {label: 'Connecticut', value: 'CT'},
  {label: 'Delaware', value: 'DE'},
  {label: 'Florida', value: 'FL'},
  {label: 'Georgia', value: 'GA'},
  {label: 'Hawaii', value: 'HI'},
  {label: 'Idaho', value: 'ID'},
  {label: 'Illinois', value: 'IL'},
  {label: 'Indiana', value: 'IN'},
  {label: 'Iowa', value: 'IA'},
  {label: 'Kansas', value: 'KS'},
  {label: 'Kentucky', value: 'KY'},
  {label: 'Louisiana', value: 'LA'},
  {label: 'Maine', value: 'ME'},
  {label: 'Maryland', value: 'MD'},
  {label: 'Massachusetts', value: 'MA'},
  {label: 'Michigan', value: 'MI'},
  {label: 'Minnesota', value: 'MN'},
  {label: 'Mississippi', value: 'MS'},
  {label: 'Missouri', value: 'MO'},
  {label: 'Montana', value: 'MT'},
  {label: 'Nebraska', value: 'NE'},
  {label: 'Nevada', value: 'NV'},
  {label: 'New Hampshire', value: 'NH'},
  {label: 'New Jersey', value: 'NJ'},
  {label: 'New Mexico', value: 'NM'},
  {label: 'New York', value: 'NY'},
  {label: 'North Carolina', value: 'NC'},
  {label: 'North Dakota', value: 'ND'},
  {label: 'Ohio', value: 'OH'},
  {label: 'Oklahoma', value: 'OK'},
  {label: 'Oregon', value: 'OR'},
  {label: 'Pennsylvania', value: 'PA'},
  {label: 'Rhode Island', value: 'RI'},
  {label: 'South Carolina', value: 'SC'},
  {label: 'South Dakota', value: 'SD'},
  {label: 'Tennessee', value: 'TN'},
  {label: 'Texas', value: 'TX'},
  {label: 'Utah', value: 'UT'},
  {label: 'Vermont', value: 'VT'},
  {label: 'Virginia', value: 'VA'},
  {label: 'Washington', value: 'WA'},
  {label: 'West Virginia', value: 'WV'},
  {label: 'Wisconsin', value: 'WI'},
  {label: 'Wyoming', value: 'WY'},
];

const COUNTRY_OPTIONS = [
  {label: 'United States', value: 'US'},
  {label: 'Canada', value: 'CA'},
];

function AddressForm({
  address,
  onChange,
}: {
  address: CustomerAddress;
  onChange: (address: CustomerAddress) => void;
}) {
  const update = (field: keyof CustomerAddress, value: string) => {
    onChange({...address, [field]: value});
  };

  const countryValue =
    normalizeCountryCode(
      address.countryCode || address.countryCodeV2,
      address.country,
    ) || 'US';

  return (
    <FormLayout>
      <FormLayout.Group>
        <PolarisTextField
          label="First name"
          autoComplete="given-name"
          value={address.firstName || ''}
          onChange={(v) => update('firstName', v)}
        />
        <PolarisTextField
          label="Last name"
          autoComplete="family-name"
          value={address.lastName || ''}
          onChange={(v) => update('lastName', v)}
        />
      </FormLayout.Group>
      <PolarisTextField
        label="Address"
        autoComplete="address-line1"
        value={address.address1 || ''}
        onChange={(v) => update('address1', v)}
      />
      <PolarisTextField
        label="Apartment, suite, etc."
        autoComplete="address-line2"
        value={address.address2 || ''}
        onChange={(v) => update('address2', v)}
      />
      <FormLayout.Group>
        <PolarisTextField
          label="City"
          autoComplete="address-level2"
          value={address.city || ''}
          onChange={(v) => update('city', v)}
        />
        <Select
          label="State"
          options={[{label: 'Select a state', value: ''}, ...US_STATES]}
          value={address.provinceCode || address.province || ''}
          onChange={(v) => onChange({...address, provinceCode: v, province: v})}
        />
      </FormLayout.Group>
      <FormLayout.Group>
        <PolarisTextField
          label="ZIP code"
          autoComplete="postal-code"
          value={address.zip || ''}
          onChange={(v) => update('zip', v)}
        />
        <Select
          label="Country"
          options={COUNTRY_OPTIONS}
          value={countryValue}
          onChange={(value) => {
            const selectedCountry =
              COUNTRY_OPTIONS.find((country) => country.value === value) ||
              null;
            onChange({
              ...address,
              countryCode: value,
              countryCodeV2: value,
              country: selectedCountry?.label || address.country,
            });
          }}
        />
      </FormLayout.Group>
      <PolarisTextField
        label="Phone"
        autoComplete="tel"
        type="tel"
        value={address.phone || ''}
        onChange={(v) => update('phone', v)}
      />
    </FormLayout>
  );
}

function formatPaymentMethodBrand(brand: string): string {
  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    americanexpress: 'American Express',
    american_express: 'American Express',
    discover: 'Discover',
    dinersclub: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
    shoppay: 'Shop Pay',
    paypal: 'PayPal',
    maestro: 'Maestro',
    elo: 'Elo',
    bogus: 'Bogus',
  };
  return brands[brand.toLowerCase()] || brand;
}

function PaymentMethodRow({
  paymentMethod,
  customerId,
}: {
  paymentMethod: CustomerPaymentMethodOption;
  customerId: string;
}) {
  const [popoverActive, setPopoverActive] = useState(false);

  const togglePopover = useCallback(
    () => setPopoverActive((active) => !active),
    [],
  );

  const brandLabel = formatPaymentMethodBrand(paymentMethod.brand);
  const iconBrand = paymentMethod.brand.toLowerCase().replace(/[_\s]/g, '');

  const displayText =
    paymentMethod.instrumentType === 'paypal'
      ? paymentMethod.paypalEmail || 'PayPal'
      : `${brandLabel} •••• ${paymentMethod.lastDigits}`;

  const expiryText =
    paymentMethod.expiryMonth && paymentMethod.expiryYear
      ? `Expires ${String(paymentMethod.expiryMonth).padStart(2, '0')}/${String(paymentMethod.expiryYear).slice(-2)}`
      : null;

  return (
    <InlineGrid columns="auto 1fr auto" gap="400" alignItems="start">
      <PaymentIcon brand={iconBrand} />
      <BlockStack>
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {displayText}
        </Text>
        {expiryText ? (
          <Text as="span" variant="bodyMd" tone="subdued">
            {expiryText}
          </Text>
        ) : null}
      </BlockStack>
      <Popover
        active={popoverActive}
        activator={
          <Button
            variant="plain"
            icon={MenuHorizontalIcon}
            accessibilityLabel="More actions"
            onClick={togglePopover}
          />
        }
        onClose={togglePopover}
      >
        <ActionList
          items={[
            {
              content: 'Send link to update payment method',
              onAction: () => {
                setPopoverActive(false);
                open(
                  `shopify:admin/customers/${safeParseGid(customerId)}`,
                  '_top',
                );
              },
            },
            {
              content: 'Remove payment method',
              destructive: true,
              onAction: () => {
                setPopoverActive(false);
                open(
                  `shopify:admin/customers/${safeParseGid(customerId)}`,
                  '_top',
                );
              },
            },
          ]}
        />
      </Popover>
    </InlineGrid>
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
  const firstNameInput =
    (formData.get('firstName') as string | null)?.trim() || '';
  const lastNameInput =
    (formData.get('lastName') as string | null)?.trim() || '';
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

    const nameSeedAddress =
      firstName || lastName
        ? {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
          }
        : null;

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
        shippingAddress: nameSeedAddress,
        billingAddress: nameSeedAddress,
        paymentMethods: [],
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

async function createSubscriptionContract(
  admin: Awaited<ReturnType<typeof authenticate.admin>>['admin'],
  formData: FormData,
): Promise<{contractId: string} | {error: string}> {
  const consentAccepted = formData.get('customerConsentAccepted') === 'true';
  if (!consentAccepted) {
    return {
      error:
        'You must confirm customer consent before saving this subscription.',
    };
  }

  const selectedCustomerPayload = parseJsonFormField<CustomerOption>(
    formData.get('selectedCustomerPayload'),
  );
  const selectedCustomerId =
    (formData.get('selectedCustomerId') as string | null)?.trim() ||
    selectedCustomerPayload?.id ||
    '';

  if (!selectedCustomerId) {
    return {
      error: 'Select a customer before saving this subscription.',
    };
  }

  const paymentMethodId =
    selectedCustomerPayload?.paymentMethods?.find((paymentMethod) =>
      Boolean(paymentMethod.id),
    )?.id || '';

  const rawProducts = parseJsonFormField<SelectedProduct[]>(
    formData.get('selectedProductsPayload'),
  );

  const selectedProducts = (rawProducts ?? [])
    .map((product) => {
      const variantId =
        typeof product?.variantId === 'string' ? product.variantId.trim() : '';
      const quantity = Number.parseInt(String(product?.quantity ?? ''), 10);
      const basePrice = Number.parseFloat(String(product?.price ?? ''));
      const discountValue = Number.parseFloat(
        String(product?.discountValue ?? ''),
      );
      const currentPrice = getDiscountedLinePrice({
        price: basePrice,
        discountType: product?.discountType,
        discountValue: Number.isFinite(discountValue)
          ? discountValue
          : undefined,
      });
      const currencyCode =
        typeof product?.currencyCode === 'string' && product.currencyCode
          ? product.currencyCode
          : 'USD';

      if (
        !variantId ||
        !Number.isFinite(quantity) ||
        quantity < 1 ||
        !Number.isFinite(currentPrice)
      ) {
        return null;
      }

      return {
        variantId,
        quantity: Math.max(1, Math.trunc(quantity)),
        currentPrice,
        currencyCode,
      };
    })
    .filter(Boolean) as Array<{
    variantId: string;
    quantity: number;
    currentPrice: number;
    currencyCode: string;
  }>;

  if (selectedProducts.length === 0) {
    return {
      error: 'Add at least one product before saving this subscription.',
    };
  }

  const interval = normalizeDeliveryInterval(
    (formData.get('deliveryPolicy.interval') as string | null)?.trim() || '',
  );
  if (!interval) {
    return {
      error: 'Select a valid delivery interval before saving.',
    };
  }

  const intervalCount = Number.parseInt(
    (formData.get('deliveryPolicy.intervalCount') as string | null) || '',
    10,
  );
  if (!Number.isFinite(intervalCount) || intervalCount < 1) {
    return {
      error: 'Enter a valid delivery interval count before saving.',
    };
  }

  const chargeCustomerDate =
    (formData.get('chargeCustomerDate') as string | null)?.trim() || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(chargeCustomerDate)) {
    return {
      error: 'Select a valid charge date before saving.',
    };
  }

  const deliveryMethod = buildDeliveryMethodInput(
    selectedCustomerPayload?.shippingAddress ??
      selectedCustomerPayload?.billingAddress,
  );

  if (!deliveryMethod) {
    return {
      error:
        'The selected customer needs a complete shipping address (including state/province code for US addresses) before creating the subscription.',
    };
  }

  const note = (
    (formData.get('manualSubscriptionNotes') as string | null) || ''
  )
    .trim()
    .slice(0, 5000);

  const variables = {
    input: {
      customerId: selectedCustomerId,
      currencyCode: selectedProducts[0]?.currencyCode || 'USD',
      nextBillingDate: `${chargeCustomerDate}T08:00:00-05:00`,
      lines: selectedProducts.map((product) => ({
        line: {
          productVariantId: product.variantId,
          quantity: product.quantity,
          currentPrice: formatPriceAmountForMutation(product.currentPrice),
        },
      })),
      contract: {
        status: 'ACTIVE',
        ...(paymentMethodId ? {paymentMethodId} : {}),
        deliveryPrice: 0,
        billingPolicy: {
          interval,
          intervalCount,
        },
        deliveryPolicy: {
          interval,
          intervalCount,
        },
        deliveryMethod,
        ...(note ? {note} : {}),
      },
    },
  };

  try {
    const response = await admin.graphql(
      SubscriptionContractAtomicCreateMutation,
      {
        variables,
      },
    );
    const result = (await response.json()) as {
      errors?: Array<{message: string}>;
      data?: {
        subscriptionContractAtomicCreate?: {
          contract?: {
            id?: string;
          } | null;
          userErrors?: Array<{message: string}>;
        };
      };
    };

    if (result.errors?.length) {
      return {
        error: result.errors.map((error) => error.message).join('; '),
      };
    }

    const userErrors =
      result.data?.subscriptionContractAtomicCreate?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        error: userErrors.map((error) => error.message).join('; '),
      };
    }

    const contractId =
      result.data?.subscriptionContractAtomicCreate?.contract?.id || '';
    if (!contractId) {
      return {
        error:
          'Subscription contract was not created. Please check required customer and product data.',
      };
    }

    return {contractId};
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Failed to create subscription contract.',
    };
  }
}

function parseJsonFormField<T>(value: FormDataEntryValue | null): T | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeDeliveryInterval(value: string): DeliveryInterval | null {
  if (value === 'WEEK' || value === 'MONTH' || value === 'YEAR') {
    return value;
  }

  return null;
}

function formatPriceAmountForMutation(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number((Math.round(value * 100) / 100).toFixed(2));
}

function getDiscountedLinePrice({
  price,
  discountType,
  discountValue,
}: {
  price: number;
  discountType?: SelectedProduct['discountType'];
  discountValue?: number;
}): number {
  if (!Number.isFinite(price)) {
    return 0;
  }

  if (!discountValue || !Number.isFinite(discountValue) || discountValue <= 0) {
    return Math.max(0, price);
  }

  if (discountType === 'PERCENTAGE') {
    return Math.max(0, price * (1 - discountValue / 100));
  }

  return Math.max(0, price - discountValue);
}

function buildDeliveryMethodInput(
  address: CustomerAddress | null | undefined,
): {shipping: {address: Record<string, string>}} | null {
  if (!address) {
    return null;
  }

  const inferredProvinceCode = normalizeProvinceCode(
    address.provinceCode,
    address.province,
    undefined,
  );
  const inferredCountryCode =
    !address.country &&
    !address.countryCode &&
    !address.countryCodeV2 &&
    inferredProvinceCode &&
    US_STATES.some((state) => state.value === inferredProvinceCode)
      ? 'US'
      : undefined;

  const countryCode =
    normalizeCountryCode(
      address.countryCode || address.countryCodeV2,
      address.country,
    ) || inferredCountryCode;
  const provinceCode = normalizeProvinceCode(
    address.provinceCode,
    address.province,
    countryCode,
  );
  const countryLabel =
    address.country || (countryCode === 'US' ? 'United States' : undefined);

  const formattedAddress = {
    ...(address.firstName ? {firstName: address.firstName} : {}),
    ...(address.lastName ? {lastName: address.lastName} : {}),
    ...(address.address1 ? {address1: address.address1} : {}),
    ...(address.address2 ? {address2: address.address2} : {}),
    ...(address.city ? {city: address.city} : {}),
    ...(address.province ? {province: address.province} : {}),
    ...(provinceCode ? {provinceCode} : {}),
    ...(address.zip ? {zip: address.zip} : {}),
    ...(countryLabel ? {country: countryLabel} : {}),
    ...(countryCode ? {countryCode} : {}),
    ...(address.phone ? {phone: address.phone} : {}),
  };

  if (
    !formattedAddress.address1 ||
    !formattedAddress.city ||
    (!formattedAddress.country && !formattedAddress.countryCode)
  ) {
    return null;
  }

  if (countryCode === 'US' && !provinceCode) {
    return null;
  }

  return {
    shipping: {
      address: formattedAddress,
    },
  };
}

function normalizeCountryCode(
  inputCountryCode?: string,
  inputCountryName?: string,
): string | undefined {
  const normalizedCode = (inputCountryCode || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(normalizedCode)) {
    return normalizedCode;
  }

  const normalizedName = (inputCountryName || '').trim().toLowerCase();
  if (normalizedName === 'united states' || normalizedName === 'usa') {
    return 'US';
  }
  if (normalizedName === 'canada') {
    return 'CA';
  }
  if (/^[a-z]{2}$/.test(normalizedName)) {
    return normalizedName.toUpperCase();
  }

  return undefined;
}

function normalizeProvinceCode(
  inputProvinceCode?: string,
  inputProvinceName?: string,
  countryCode?: string,
): string | undefined {
  const normalizedCode = (inputProvinceCode || '').trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(normalizedCode)) {
    return normalizedCode;
  }

  const normalizedProvinceName = (inputProvinceName || '').trim().toLowerCase();
  if (!normalizedProvinceName) {
    return undefined;
  }

  if (countryCode === 'US') {
    const usMatch = US_STATES.find(
      (state) => state.label.toLowerCase() === normalizedProvinceName,
    );
    if (usMatch) {
      return usMatch.value;
    }
  }

  if (/^[a-z]{2,3}$/.test(normalizedProvinceName)) {
    return normalizedProvinceName.toUpperCase();
  }

  return undefined;
}

function withAddressDefaults(address: CustomerAddress): CustomerAddress {
  const normalizedCountryCode =
    normalizeCountryCode(
      address.countryCode || address.countryCodeV2,
      address.country,
    ) || 'US';
  const normalizedProvinceCode = normalizeProvinceCode(
    address.provinceCode,
    address.province,
    normalizedCountryCode,
  );
  const countryLabel =
    address.country ||
    COUNTRY_OPTIONS.find(
      (countryOption) => countryOption.value === normalizedCountryCode,
    )?.label ||
    (normalizedCountryCode === 'US'
      ? 'United States'
      : normalizedCountryCode === 'CA'
        ? 'Canada'
        : undefined);

  return {
    ...address,
    provinceCode: address.provinceCode || normalizedProvinceCode || undefined,
    province: address.province || normalizedProvinceCode || undefined,
    country: countryLabel,
    countryCode: normalizedCountryCode,
    countryCodeV2: normalizedCountryCode,
  };
}

function escapeSearchValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function mapPaymentMethods(
  paymentMethods?: {edges?: Array<{node?: any}>} | null,
): CustomerPaymentMethodOption[] {
  if (!paymentMethods?.edges) return [];

  return paymentMethods.edges
    .map((edge: any) => {
      const node = edge.node;
      if (!node || node.revokedAt) return null;

      const instrument = node.instrument;
      if (!instrument) return null;

      const typeName = instrument.__typename;

      if (typeName === 'CustomerPaypalBillingAgreement') {
        return {
          id: node.id,
          brand: 'paypal',
          lastDigits: '',
          maskedNumber: '',
          expiryMonth: 0,
          expiryYear: 0,
          instrumentType: 'paypal' as const,
          paypalEmail: instrument.paypalAccountEmail || '',
        };
      }

      return {
        id: node.id,
        brand: (
          instrument.brand ||
          (typeName === 'CustomerShopPayAgreement' ? 'shoppay' : '')
        ).toLowerCase(),
        lastDigits: instrument.lastDigits || '',
        maskedNumber: instrument.maskedNumber || '',
        expiryMonth: instrument.expiryMonth || 0,
        expiryYear: instrument.expiryYear || 0,
        instrumentType:
          typeName === 'CustomerShopPayAgreement'
            ? ('shop_pay' as const)
            : ('credit_card' as const),
      };
    })
    .filter(Boolean) as CustomerPaymentMethodOption[];
}

function mapCustomerNode(node: {
  id: string;
  legacyResourceId?: string | number | null;
  displayName?: string;
  email?: string | null;
  numberOfOrders?: number;
  defaultAddress?: CustomerAddress | null;
  paymentMethods?: any;
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
    paymentMethods: mapPaymentMethods(node.paymentMethods),
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
    countryCode: address.countryCode || address.countryCodeV2 || undefined,
    phone: address.phone || undefined,
  };
}

function getIsoDateFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function getCustomerNameParts(
  customer: CustomerOption | null | undefined,
): Pick<CustomerAddress, 'firstName' | 'lastName'> {
  const displayName = (customer?.displayName || '').trim();
  if (!displayName || displayName.includes('@')) {
    return {};
  }

  const [firstNameRaw, ...lastNameParts] = displayName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!firstNameRaw) {
    return {};
  }

  const lastNameRaw = lastNameParts.join(' ').trim();

  return {
    firstName: firstNameRaw,
    lastName: lastNameRaw || undefined,
  };
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
    address.countryCode || address.country,
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
