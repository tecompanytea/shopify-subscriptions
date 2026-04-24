import {useFormContext} from '@rvf/react-router';
import {Button} from '~/components/polaris';

export interface SubmitButtonProps {
  children: string;
  disabled?: boolean;
}

export const SubmitButton = ({children, disabled = false}: SubmitButtonProps) => {
  const form = useFormContext();

  return (
    <Button
      submit
      variant="primary"
      disabled={
        disabled || form.formState.isSubmitting || !form.formState.isDirty
      }
      loading={form.formState.isSubmitting}
    >
      {children}
    </Button>
  );
};
