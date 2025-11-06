import { Check } from "lucide-react";
import { WizardStep } from "./types";

interface WizardProgressProps {
  currentStep: WizardStep;
}

const steps = [
  { label: "Business", step: WizardStep.BusinessEssentials },
  { label: "Plan", step: WizardStep.PlanSelection },
  { label: "Details", step: WizardStep.BusinessDetails },
  { label: "Payment", step: WizardStep.Payment },
  { label: "Phone", step: WizardStep.PhoneNumberSelection },
  { label: "Complete", step: WizardStep.SetupComplete },
];

export const WizardProgress = ({ currentStep }: WizardProgressProps) => {
  return (
    <div className="w-full mb-8">
      {/* Mobile: Simple dots */}
      <div className="block sm:hidden text-center space-y-3">
        <p className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </p>
        <div className="flex justify-center gap-2">
          {steps.map((step) => (
            <div
              key={step.step}
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                step.step === currentStep
                  ? "bg-primary w-6"
                  : step.step < currentStep
                  ? "bg-primary/60"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Desktop: Full stepper */}
      <div className="hidden sm:block">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-all duration-300 ${
                    step.step < currentStep
                      ? "bg-primary text-primary-foreground"
                      : step.step === currentStep
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.step < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium transition-colors ${
                    step.step <= currentStep
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 transition-colors duration-300 ${
                    step.step < currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
