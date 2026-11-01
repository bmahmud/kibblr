import { NavLink } from '@/components/nav-link';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function SignInScreen() {
  return (
    <PlaceholderScreen title="Sign in" phase={1}>
      <NavLink href="/" label="Back to Inventory" />
    </PlaceholderScreen>
  );
}
