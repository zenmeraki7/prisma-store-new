import { useEffect, useState } from "react";

export default function SessionDashboard() {
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState({ id: "", shop: "", accessToken: "" });

  const fetchSessions = async () => {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(data);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ id: "", shop: "", accessToken: "" });
    fetchSessions();
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Prisma Session Dashboard</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: "1rem" }}>
        <input
          placeholder="Session ID"
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
          required
        />
        <input
          placeholder="Shop"
          value={form.shop}
          onChange={(e) => setForm({ ...form, shop: e.target.value })}
          required
        />
        <input
          placeholder="Access Token"
          value={form.accessToken}
          onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
          required
        />
        <button type="submit">Add Session</button>
      </form>

      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>ID</th>
            <th>Shop</th>
            <th>Access Token</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.shop}</td>
              <td>{s.accessToken || "-"}</td>
              <td>{s.expires || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
