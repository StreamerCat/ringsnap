import { useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { isGenericEmail, extractCompanyNameFromEmail } from '@/components/signup/shared/utils';

/**
 * Smart Email Detection Hook
 *
 * Automatically detects business emails and pre-fills:
 * - Company name (from domain)
 * - Website (from domain)
 *
 * Usage:
 * ```tsx
 * const form = useForm<FormData>(...);
 * useSmartEmail(form, 'email', {
 *   companyNameField: 'companyName',
 *   websiteField: 'website'
 * });
 * ```
 */

interface UseSmartEmailOptions {
  /**
   * Form field name for company name (default: 'companyName')
   */
  companyNameField?: string;

  /**
   * Form field name for website (default: 'website')
   */
  websiteField?: string;

  /**
   * Whether to auto-populate company name (default: true)
   */
  autoFillCompanyName?: boolean;

  /**
   * Whether to auto-populate website (default: true)
   */
  autoFillWebsite?: boolean;

  /**
   * Callback when business email is detected
   */
  onBusinessEmailDetected?: (domain: string, companyName: string) => void;

  /**
   * Callback when generic email is detected
   */
  onGenericEmailDetected?: () => void;
}

export function useSmartEmail<TFormData extends Record<string, any>>(
  form: UseFormReturn<TFormData>,
  emailFieldName: keyof TFormData & string = 'email',
  options: UseSmartEmailOptions = {}
) {
  const {
    companyNameField = 'companyName',
    websiteField = 'website',
    autoFillCompanyName = true,
    autoFillWebsite = true,
    onBusinessEmailDetected,
    onGenericEmailDetected,
  } = options;

  const [isBusinessEmail, setIsBusinessEmail] = useState(false);
  const [detectedDomain, setDetectedDomain] = useState<string | null>(null);

  const emailValue = form.watch(emailFieldName);

  useEffect(() => {
    // Reset state if email is empty or invalid
    if (!emailValue || !emailValue.includes('@')) {
      setIsBusinessEmail(false);
      setDetectedDomain(null);
      return;
    }

    const email = String(emailValue).toLowerCase().trim();

    // Validate email format (basic check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return;
    }

    const domain = email.split('@')[1];
    const isGeneric = isGenericEmail(email);

    if (!isGeneric) {
      // Business email detected
      setIsBusinessEmail(true);
      setDetectedDomain(domain);

      const companyName = extractCompanyNameFromEmail(email);

      // Auto-fill company name if field is empty
      if (autoFillCompanyName && companyNameField in form.getValues()) {
        const currentCompanyName = form.getValues(companyNameField as any);
        if (!currentCompanyName || currentCompanyName.trim() === '') {
          form.setValue(companyNameField as any, companyName, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }

      // Auto-fill website if field is empty
      if (autoFillWebsite && websiteField in form.getValues()) {
        const currentWebsite = form.getValues(websiteField as any);
        if (!currentWebsite || currentWebsite.trim() === '') {
          form.setValue(websiteField as any, `https://${domain}`, {
            shouldValidate: true,
            shouldDirty: true,
          });
        }
      }

      // Call callback
      onBusinessEmailDetected?.(domain, companyName);
    } else {
      // Generic email detected
      setIsBusinessEmail(false);
      setDetectedDomain(null);
      onGenericEmailDetected?.();
    }
  }, [
    emailValue,
    form,
    companyNameField,
    websiteField,
    autoFillCompanyName,
    autoFillWebsite,
    onBusinessEmailDetected,
    onGenericEmailDetected,
  ]);

  return {
    /** Whether the detected email is a business email (not generic) */
    isBusinessEmail,

    /** The detected domain (null if generic or invalid) */
    detectedDomain,

    /** Whether the detected email is a generic provider (gmail, yahoo, etc) */
    isGenericEmail: !isBusinessEmail && !!emailValue && emailValue.includes('@'),
  };
}
