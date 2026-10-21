import { notFound } from "next/navigation";
import { loanOfficers } from "@/lib/store";
import { loanOfficerToValues } from "@/lib/formValues";
import { LoanOfficerForm } from "@/components/admin/LoanOfficerForm";
import { deleteLoanOfficerAction } from "@/app/admin/actions";

export default async function EditLoanOfficerPage({ params }: PageProps<"/admin/loan-officers/[slug]">) {
  const { slug } = await params;
  const lo = await loanOfficers.get(slug);
  if (!lo) notFound();
  return (
    <>
      <h1>{lo.name}</h1>
      <p className="muted small">
        API slug: <code>{lo.slug}</code> — use this as <code>loanOfficerSlug</code> when creating listings via the API.
      </p>
      <LoanOfficerForm slug={slug} initial={loanOfficerToValues(lo)} />
      <form action={deleteLoanOfficerAction.bind(null, slug)} className="danger-zone">
        <button className="btn btn-small btn-danger">Delete loan officer</button>
      </form>
    </>
  );
}
