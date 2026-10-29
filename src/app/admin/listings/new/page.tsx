import Link from "next/link";
import { loanOfficers } from "@/lib/store";
import { ListingForm } from "@/components/admin/ListingForm";
import { blobMode } from "@/lib/blob";

export default async function NewListingPage({ searchParams }: PageProps<"/admin/listings/new">) {
  const los = await loanOfficers.list();
  const lo = (await searchParams).lo;
  if (!los.length)
    return (
      <div className="empty">
        <p>Add a loan officer before creating listings.</p>
        <Link className="btn" href="/admin/loan-officers/new">
          Add loan officer
        </Link>
      </div>
    );
  return (
    <>
      <h1>New listing kit</h1>
      <ListingForm
        slug={null}
        initial={{ loanOfficerSlug: typeof lo === "string" ? lo : los[0].slug }}
        loanOfficers={los.map(({ slug, name }) => ({ slug, name }))}
        uploadMode={blobMode()}
      />
    </>
  );
}
