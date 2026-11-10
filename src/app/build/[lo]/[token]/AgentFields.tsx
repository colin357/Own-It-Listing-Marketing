"use client";

import { useState } from "react";

/**
 * Shown when the listing feed has no agent for the home. New construction
 * (usually listed by the builder) asks for the builder and community; anything
 * else asks for the listing agent. The LO can switch if we guessed wrong.
 */
export function AgentFields({ newConstruction, yearBuilt, office }: { newConstruction?: boolean; yearBuilt?: number; office?: string }) {
  const [builder, setBuilder] = useState(!!newConstruction);

  return (
    <div className="build-agent">
      <p className="build-agent-note">
        {builder
          ? `This looks like new construction${yearBuilt ? ` (built ${yearBuilt})` : ""}, so our listing feed has no agent for it. Add the builder so the graphics credit them.`
          : "Our listing feed doesn't name the agent for this home. Add them so they show on the graphics."}
      </p>
      {builder ? (
        <>
          <label className="field">
            <span className="field-label">Builder</span>
            <input name="builder" required defaultValue={office} placeholder="e.g. Lennar" autoComplete="off" />
          </label>
          <label className="field">
            <span className="field-label">Community</span>
            <input name="community" placeholder="Optional, e.g. Poplar Grove" autoComplete="off" />
          </label>
          <label className="field">
            <span className="field-label">Sales contact</span>
            <input name="salesContact" placeholder="Optional, the builder's sales agent" autoComplete="off" />
          </label>
          <label className="field">
            <span className="field-label">Phone</span>
            <input name="agentPhone" type="tel" placeholder="Optional" autoComplete="off" />
          </label>
        </>
      ) : (
        <>
          <label className="field">
            <span className="field-label">Listing agent</span>
            <input name="agentName" required placeholder="Full name" autoComplete="off" />
          </label>
          <label className="field">
            <span className="field-label">Brokerage</span>
            <input name="agentBrokerage" defaultValue={office} placeholder="Optional" autoComplete="off" />
          </label>
          <label className="field">
            <span className="field-label">Agent phone</span>
            <input name="agentPhone" type="tel" placeholder="Optional" autoComplete="off" />
          </label>
        </>
      )}
      <button type="button" className="build-agent-switch" onClick={() => setBuilder((b) => !b)}>
        {builder ? "Not new construction? Enter the listing agent instead" : "New construction? Enter the builder instead"}
      </button>
    </div>
  );
}
