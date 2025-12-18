# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "Welcome Back" [level=3] [ref=e6]
      - paragraph [ref=e7]: Sign in to access your RingSnap account
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic [ref=e10]:
          - text: Email
          - textbox "Email" [active] [ref=e11]:
            - /placeholder: your@email.com
        - generic [ref=e12]:
          - text: Password
          - textbox "Password" [ref=e13]:
            - /placeholder: Enter your password
        - button "Sign In" [ref=e14] [cursor=pointer]
        - button "Forgot password?" [ref=e16] [cursor=pointer]
      - button "Back to Homepage" [ref=e18] [cursor=pointer]
```