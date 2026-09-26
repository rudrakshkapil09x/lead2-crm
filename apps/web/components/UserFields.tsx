"use client";
import { Field } from "./UI";
export default function UserFields({
  f,
  setF,
  roles,
  users,
  passwordRequired = true,
}: {
  f: any;
  setF: (x: any) => void;
  roles: any[];
  users: any[];
  passwordRequired?: boolean;
}) {
  return (
    <>
      <div className="form-grid">
        <Field label="Full name">
          <input
            required
            className="input"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        <Field label="Work email">
          <input
            required
            type="email"
            className="input"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
        </Field>
      </div>
      <Field
        label={
          passwordRequired ? "Temporary password" : "Reset password (optional)"
        }
        hint="At least 12 characters. The user must change a temporary password on sign in."
      >
        <input
          required={passwordRequired}
          minLength={12}
          type="password"
          autoComplete="new-password"
          className="input"
          value={f.password || ""}
          onChange={(e) => setF({ ...f, password: e.target.value })}
        />
      </Field>
      <div className="form-grid">
        <Field label="Role">
          <select
            required
            className="input"
            value={f.roleId}
            onChange={(e) =>
              setF({ ...f, roleId: e.target.value, managerId: "" })
            }
          >
            <option value="">Select role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reports to">
          <select
            className="input"
            disabled={
              roles.find((r) => r.id === f.roleId)?.code ===
              "client_super_admin"
            }
            value={f.managerId || ""}
            onChange={(e) => setF({ ...f, managerId: e.target.value })}
          >
            <option value="">No reporting manager</option>
            {users
              .filter(
                (x) =>
                  x.active && x.role_code !== "sales_member" && x.id !== f.id,
              )
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </Field>
      </div>
    </>
  );
}
