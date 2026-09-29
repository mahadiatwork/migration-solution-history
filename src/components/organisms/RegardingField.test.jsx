import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RegardingField from "./RegardingField";
import { CUSTOM_REGARDING_VALUE } from "./helperFunc";

const authoritativeConfig = {
  _source: "custom_module",
  regarding: {},
};

const configWithReservedAndOtherOptions = {
  _source: "custom_module",
  regarding: {
    "Unconfigured type": ["Custom", CUSTOM_REGARDING_VALUE, "Other"],
  },
};

const renderField = (initialRegarding = "", picklistConfig = authoritativeConfig) => {
  const Harness = () => {
    const [formData, setFormData] = React.useState({
      type: "Unconfigured type",
      regarding: initialRegarding,
    });

    const handleInputChange = (field, value) => {
      setFormData((current) => ({ ...current, [field]: value }));
    };

    return (
      <>
        <RegardingField
          formData={formData}
          handleInputChange={handleInputChange}
          selectedRowData={null}
          picklistConfig={picklistConfig}
        />
        <output data-testid="saved-regarding">{formData.regarding}</output>
      </>
    );
  };

  render(<Harness />);
};

describe("RegardingField custom option", () => {
  test.each([
    ["CRM has no options for the selected type", authoritativeConfig],
    [
      "CRM has configured options for the selected type",
      {
        _source: "custom_module",
        regarding: { "Unconfigured type": ["Configured regarding"] },
      },
    ],
    ["the CRM configuration is unavailable", null],
  ])("always offers Custom when %s", (_scenario, picklistConfig) => {
    renderField("", picklistConfig);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Regarding" }));

    expect(screen.getByRole("option", { name: "Custom" })).toBeVisible();
  });

  test("writes custom text to form state on every change", () => {
    renderField("Other", configWithReservedAndOtherOptions);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Regarding" }));
    fireEvent.click(screen.getByRole("option", { name: "Custom" }));
    expect(screen.getByTestId("saved-regarding")).toBeEmptyDOMElement();

    fireEvent.change(screen.getByLabelText("Enter your custom regarding"), {
      target: { value: "My own regarding" },
    });
    fireEvent.change(screen.getByLabelText("Enter your custom regarding"), {
      target: { value: "My updated regarding" },
    });

    expect(screen.getByTestId("saved-regarding")).toHaveTextContent(
      "My updated regarding"
    );
    expect(screen.getByLabelText("Enter your custom regarding")).toHaveValue(
      "My updated regarding"
    );
  });

  test("renders one Custom option and keeps configured Other as a normal option", () => {
    renderField("", configWithReservedAndOtherOptions);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Regarding" }));

    expect(screen.getAllByRole("option", { name: "Custom" })).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Other" })).toBeVisible();
    expect(
      screen.queryByRole("option", { name: CUSTOM_REGARDING_VALUE })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "Other" }));

    expect(
      screen.queryByLabelText("Enter your custom regarding")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("saved-regarding")).toHaveTextContent("Other");
  });
});
