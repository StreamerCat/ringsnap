import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import AISignup from "./AISignup";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY!);

export default function AISignupWrapper() {
  return (
    <Elements stripe={stripePromise}>
      <AISignup />
    </Elements>
  );
}
