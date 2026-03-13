import {useFormContext} from '@rvf/remix';
import {TextField as PolarisTextField} from '~/components/polaris';

type TextFieldProps = {
  name: string;
  label: string;
  [key: string]: any;
};

export const TextField = ({name, label, ...rest}: TextFieldProps) => {
  const form = useFormContext<any>();

  return (
    <PolarisTextField
      {...form.getInputProps(name, {
        ...rest,
        id: name,
        label,
        error: form.error(name) ?? false,
        autoComplete: 'off',
        value: form.value(name) ?? undefined,
        onChange: (value) => form.setValue(name, value),
      })}
      // getInputProps produces a ref for the element, which isn't allowed for function components
      {...{ref: undefined}}
    />
  );
};
