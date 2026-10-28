"use client";

import type { CompositionLabel } from "~/modules/catalog/domain/constants";

import { Field } from "~/app/merchant/merchant-fields.client";
import { INDIAN_STATES } from "~/modules/catalog/domain/indian-states";

import { COMPOSITION_TEXT } from "./story-text";

/** A product's story as the desk forms hold it ("" = not given). */
export interface StoryValues {
  composition: string;
  madeBy: string;
  madeHow: string;
  originPlace: string;
  originState: string;
}

type ChangeHandler = React.ChangeEventHandler<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

/** Where it comes from, who made it, how, and what goes into it. */
export function StoryFields({
  compositionLabel,
  errors,
  onChange,
  values,
}: {
  compositionLabel: CompositionLabel;
  errors: Record<string, string>;
  onChange: (key: keyof StoryValues) => ChangeHandler;
  values: StoryValues;
}) {
  const label = COMPOSITION_TEXT[compositionLabel];
  return (
    <div className="form-grid">
      <div className="field">
        <label htmlFor="originState">State</label>
        <select
          aria-describedby={
            errors.originState ? "originState-error" : undefined
          }
          aria-invalid={errors.originState ? true : undefined}
          id="originState"
          onChange={onChange("originState")}
          value={values.originState}
        >
          <option value="">Choose a state</option>
          {INDIAN_STATES.map((state) => (
            <option key={state.slug} value={state.slug}>
              {state.name}
            </option>
          ))}
        </select>
        {errors.originState && (
          <p className="field-error" id="originState-error">
            {errors.originState}
          </p>
        )}
      </div>
      <Field
        error={errors.originPlace}
        id="originPlace"
        label="Village, town or district"
        maxLength={60}
        onChange={onChange("originPlace")}
        value={values.originPlace}
      />
      <div className="full">
        <Field
          error={errors.madeBy}
          hint="The people or family who make it."
          id="madeBy"
          label="Who made it"
          maxLength={80}
          onChange={onChange("madeBy")}
          value={values.madeBy}
        />
      </div>
      <fieldset className="field full check-row">
        <legend>How it is made</legend>
        {(
          [
            ["HANDMADE", "Handmade"],
            ["HOMEMADE", "Homemade"],
          ] as const
        ).map(([value, text]) => (
          <label key={value}>
            <input
              checked={values.madeHow === value}
              name="madeHow"
              onChange={onChange("madeHow")}
              type="radio"
              value={value}
            />{" "}
            {text}
          </label>
        ))}
        {errors.madeHow && <p className="field-error">{errors.madeHow}</p>}
      </fieldset>
      <div className="field full">
        <label htmlFor="composition">{label}</label>
        <textarea
          aria-describedby={
            errors.composition ? "composition-error" : "composition-hint"
          }
          aria-invalid={errors.composition ? true : undefined}
          id="composition"
          maxLength={1000}
          onChange={onChange("composition")}
          rows={3}
          value={values.composition}
        />
        <p className="field-hint" id="composition-hint">
          {compositionLabel === "MATERIALS"
            ? "What it is made of, e.g. terracotta, natural dyes."
            : "Everything that goes in, e.g. cashews, jaggery, cardamom."}
        </p>
        {errors.composition && (
          <p className="field-error" id="composition-error">
            {errors.composition}
          </p>
        )}
      </div>
    </div>
  );
}
