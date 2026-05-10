# Maestro example: login flow

Minimal [Maestro](https://maestro.mobile.dev/) flow that launches the app with a Mockifyer **client lane** (`mockifyerClientId`) and performs a simple login using **accessibility identifiers**.

## Setup

1. In your app, wire **`react-native-launch-arguments`** and Mockifyer with **`useLaunchArgumentsClientId: true`** (see root **`REACT_NATIVE.md`**).
2. Replace **`appId`** in `login.yaml` with your Android package / iOS bundle id.
3. Add matching **`testID`** / accessibility ids on your login screen (see below).

## Run

```bash
maestro test example-projects/maestro-login-flow/login.yaml
```

(Adjust the path if you run from another working directory.)

## Customize selectors

Update the `id` values to match your React Native `testID` props (or platform accessibility ids):

| Step        | Example `id` in YAML   | Typical RN mapping      |
|------------|-------------------------|-------------------------|
| Login screen | `login_screen`        | Root container `testID` |
| Email field  | `email_input`         | TextInput `testID`      |
| Password     | `password_input`      | TextInput `testID`      |
| Submit       | `sign_in_button`      | Pressable `testID`      |
| After login  | `home_screen`         | Post-auth screen `testID` |

Use **`maestro studio`** to pick stable selectors if you prefer `text` instead of `id`.
