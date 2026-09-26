import Link from "next/link";
export default function Setup() {
  return (
    <div className="main" style={{ maxWidth: 700, margin: "80px auto" }}>
      <div className="card form">
        <h1>Engineer setup</h1>
        <p>
          Lead2 Engineer accounts are provisioned by the system owner through
          the command line. Follow the Engineer setup instructions in README.md,
          then sign in here.
        </p>
        <Link className="btn" href="/super-admin/login">
          Platform sign in
        </Link>
      </div>
    </div>
  );
}
