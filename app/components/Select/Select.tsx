import {useFormContext} from '@rvf/react-router';
import {Select as PolarisSelect} from '~/components/polaris';

type SelectProps = {
  name: string;
  label: string;
  [key: string]: any;
};

export const Select = ({name, label, ...rest}: SelectProps) => {
  const form = useFormContext<any>();

  return (
    <PolarisSelect
      {...form.getInputProps(name, {
        ...rest,
        id: name,
        label,
        error: form.error(name) ?? false,
        value: form.value(name) ?? undefined,
        onChange: (value) => form.setValue(name, value),
      })}
      // getInputProps produces a ref for the element, which isn't allowed for function components
      {...{ref: undefined}}
    />
  );
};
