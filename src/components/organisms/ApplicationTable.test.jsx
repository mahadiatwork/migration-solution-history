import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ApplicationDialog from "./ApplicationTable";
import { moveContactHistoryToApplication } from "../../services/contactHistoryMove";

jest.mock("../../services/contactHistoryMove", () => ({
  moveContactHistoryToApplication: jest.fn(),
}));

jest.mock("../../zohoApi", () => ({
  zohoApi: { file: { getAttachments: jest.fn() } },
}));

describe("ApplicationDialog", () => {
  beforeEach(() => {
    moveContactHistoryToApplication.mockResolvedValue({ id: "new-history" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("moves after selecting an application without a saved-edits confirmation", async () => {
    const zoho = {};
    const handleClose = jest.fn();
    const onMoveCompleted = jest.fn();

    render(
      <ApplicationDialog
        openApplicationDialog
        handleApplicationDialogClose={handleClose}
        applications={[
          {
            id: "application-1",
            Name: "APP-001",
            Type_of_Application: "Visa",
            File_Status: "Open",
          },
        ]}
        ZOHO={zoho}
        selectedRowData={{ historyDetails: { id: "history-1" } }}
        onMoveCompleted={onMoveCompleted}
      />
    );

    expect(
      screen.queryByText(/the move uses the last saved version/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: /i have saved the edits i want to keep/i,
      })
    ).not.toBeInTheDocument();

    const moveButton = screen.getByRole("button", { name: "Move" });
    expect(moveButton).toBeDisabled();

    fireEvent.click(screen.getByRole("radio"));
    expect(moveButton).toBeEnabled();
    fireEvent.click(moveButton);

    await waitFor(() => {
      expect(moveContactHistoryToApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          zoho,
          sourceHistoryId: "history-1",
          targetMatterId: "application-1",
        })
      );
      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(onMoveCompleted).toHaveBeenCalledWith({ id: "new-history" });
    });
  });
});
