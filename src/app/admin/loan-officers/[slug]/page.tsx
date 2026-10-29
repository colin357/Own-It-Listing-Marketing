import { notFound } from "next/navigation";
import { loanOfficers } from "@/lib/store";
import { loanOfficerToValues } from "@/lib/formValues";
import { LoanOfficerForm } from "@/components/admin/LoanOfficerForm";
import { deleteLoanOfficerAction } from "@/app/admin/actions";
import { buildPath } from "@/lib/loLinks";
import { siteUrl } from "@/lib/site";
import { CopyButton } from "@/components/CopyButton";

export default async function EditLoanOfficerPage({ params }: PageProps<"/admin/loan-officers/[slug]">) {
  const { slug } = await params;
  const lo = await loanOfficers.get(slug);
  if (!lo) notFound();
  const build = buildPath(lo.slug);
  const buildUrl = build ? `${await siteUrl()}${build}` : null;
  return (
    <>
      <h1>{lo.name}</h1>
      <p className="muted small">
        API slug: <code>{lo.slug}</code> — use this as <code>loanOfficerSlug</code> when creating listings via the API.
      </p>
      {buildUrl ? (
        <div className="alert">
          <strong>Kit builder link.</strong> Send this private link to {lo.name}. They enter an MLS number and get a
          finished kit, co-branded with them.
          <div className="share-row">
            <code>{buildUrl}</code>
            <CopyButton text={buildUrl} label="Copy link" />
          </div>
        </div>
      ) : null}
      <LoanOfficerForm slug={slug} initial={loanOfficerToValues(lo)} />
      <form action={deleteLoanOfficerAction.bind(null, slug)} className="danger-zone">
        <button className="btn btn-small btn-danger">Delete loan officer</button>
      </form>
    </>
  );
}
