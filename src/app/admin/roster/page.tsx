import { getMetros, getRoster } from "@/lib/detect/roster";
import { nameParts } from "@/lib/detect/match";
import { loanOfficers } from "@/lib/store";
import { RosterForm } from "./RosterForm";

export default async function RosterPage() {
  const [agents, metros, los] = await Promise.all([getRoster(), getMetros(), loanOfficers.list()]);
  const key = (n: string) => {
    const p = nameParts(n);
    return p ? `${p.first} ${p.last}` : n.toLowerCase();
  };
  const loKeys = new Set(los.map((lo) => key(lo.name)));
  const perLo = new Map<string, number>();
  for (const a of agents) perLo.set(a.loanOfficer, (perLo.get(a.loanOfficer) ?? 0) + 1);
  const names = [...new Set([...perLo.keys(), ...metros.flatMap((m) => m.loanOfficers)])].sort();

  return (
    <>
      <div className="toolbar">
        <h1>Roster</h1>
      </div>
      <p className="muted small">
        {agents.length} agents across {perLo.size} loan officers · {metros.length} metros
      </p>
      <div className="form-actions" style={{ margin: "16px 0 24px" }}>
        <a href="/admin/roster/roster.csv" className="btn btn-ghost btn-small" download>
          Download roster CSV
        </a>
        <a href="/admin/roster/metros.csv" className="btn btn-ghost btn-small" download>
          Download metros CSV
        </a>
      </div>
      <RosterForm />

      {names.length ? (
        <div className="table-wrap" style={{ marginTop: 32 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Loan officer</th>
                <th>Agents</th>
                <th>Search areas</th>
                <th>Set up in app</th>
              </tr>
            </thead>
            <tbody>
              {names.map((n) => {
                const areas = metros.filter((m) => m.loanOfficers.some((x) => key(x) === key(n)));
                return (
                  <tr key={n}>
                    <td>
                      <strong>{n}</strong>
                    </td>
                    <td>{perLo.get(n) ?? 0}</td>
                    <td className="small">
                      {areas.length
                        ? areas.map((m, i) => (
                            <div key={i}>
                              {m.city}, {m.state}
                              {m.zip ? ` ${m.zip}` : ""} · {m.radiusMiles} mi
                            </div>
                          ))
                        : "No metro, so no listings are checked"}
                    </td>
                    <td className="small">
                      {loKeys.has(key(n)) ? "Yes" : "No: add them under Loan officers so kits can be created"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
