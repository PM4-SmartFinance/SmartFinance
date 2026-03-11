/**
 * Wireframe: Login Page
 *
 * Desktop: Centered card with logo, email/password fields, login button, footer links.
 * Mobile:  Same layout stacks naturally (≤640px) — full-width inputs, full-width button.
 *
 * Future React components: Container › Card › TextInput › PasswordInput › Button › Anchor
 */
export default function LoginWireframe() {
  return (
    <div className="wf-login-page">
      {/* ── Logo ── */}
      <div className="wf-login-logo">◈ SmartFinance</div>

      {/* ── Login Card ── */}
      <div className="wf-login-card">
        <div className="wf-login-card-label">[ Login Card ]</div>

        {/* Email */}
        <div className="wf-field">
          <label>Email / Username</label>
          <div className="wf-input">user@example.com</div>
        </div>

        {/* Password */}
        <div className="wf-field">
          <label>Password</label>
          <div className="wf-input">••••••••</div>
        </div>

        {/* Submit */}
        <div className="wf-btn">[ Login ]</div>

        {/* Footer */}
        <div className="wf-login-footer">
          <span className="wf-link">Forgot password?</span>
          &nbsp;·&nbsp;
          <span className="wf-link">Sign Up</span>
        </div>
      </div>

      {/* Component hint */}
      <p className="wf-component-hint">
        Components (Mantine): Container › Card › TextInput › PasswordInput › Button › Anchor
        <br />
        Mobile strategy: full-width inputs, button spans width, card padding reduced
      </p>
    </div>
  );
}
