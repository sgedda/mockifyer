import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={{ variables: { colorPrimary: '#34d399' } }}
      />
    </div>
  );
}
