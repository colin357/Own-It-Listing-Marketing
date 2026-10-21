import { notFound } from "next/navigation";
import { listings, loanOfficers } from "@/lib/store";
import { listingToValues } from "@/lib/formValues";
import { streetLine } from "@/lib/format";
import { ListingForm } from "@/components/admin/ListingForm";
import { deleteListingAction } from "@/app/admin/actions";

export default async function EditListingPage({ params }: PageProps<"/admin/listings/[slug]">) {
  const { slug } = await params;
  const [listing, los] = await Promise.all([listings.get(slug), loanOfficers.list()]);
  if (!listing) notFound();
  return (
    <>
      <div className="toolbar">
        <h1>{streetLine(listing)}</h1>
        <a className="btn btn-small btn-ghost" href={`/l/${slug}`} target="_blank" rel="noreferrer">
          View kit ↗
        </a>
      </div>
      <ListingForm
        slug={slug}
        initial={listingToValues(listing)}
        loanOfficers={los.map(({ slug, name }) => ({ slug, name }))}
        uploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN}
      />
      <form action={deleteListingAction.bind(null, slug)} className="danger-zone">
        <p className="small muted">Deleting removes the kit page. Links already sent to the agent will stop working.</p>
        <button className="btn btn-small btn-danger">Delete listing</button>
      </form>
    </>
  );
}
