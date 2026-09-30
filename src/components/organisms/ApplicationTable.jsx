import React, { useEffect, useState } from "react";
import { zohoApi } from "../../zohoApi";
import { moveContactHistoryToApplication } from "../../services/contactHistoryMove";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Radio,
  Button,
  Dialog as MUIDialog,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  CircularProgress,
  Box,
} from "@mui/material";


const ApplicationTable = ({
  applications,
  selectedApplicationId,
  setSelectedApplicationId,
}) => {
  const handleRowSelect = (id) => {
    setSelectedApplicationId(id);
  };

  return (
    <TableContainer>
      <Table sx={{ fontSize: "9pt" }}>
        <TableHead>
          <TableRow></TableRow>
          <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
            {" "}
            {/* Custom header color */}
            <TableCell />
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Application No
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Type of Application
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              File Status
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              File Progress
            </TableCell>
            <TableCell sx={{ fontWeight: "bold", fontSize: "9pt" }}>
              Visa Grant Date
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(Array.isArray(applications) ? applications : []).map((app) => (
            <TableRow key={app.id}>
              <TableCell>
                <Radio
                  checked={selectedApplicationId === app.id}
                  onChange={() => handleRowSelect(app.id)}
                  sx={{ padding: "4px" }} // Reduce padding
                />
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>{app.Name}</TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {app.Type_of_Application}
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>{app.File_Status}</TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {app.File_Progress || "-"}
              </TableCell>
              <TableCell sx={{ fontSize: "9pt" }}>
                {app.Visa_Grant_Date || "N/A"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ApplicationDialog = ({
  openApplicationDialog,
  handleApplicationDialogClose,
  applications,
  ZOHO,
  selectedRowData,
  onMoveCompleted,
}) => {
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  useEffect(() => {
    if (openApplicationDialog) {
      setSelectedApplicationId(null);
    }
  }, [openApplicationDialog]);

  const handleApplicationSelect = async () => {
    if (isMoving) return;
    if (!selectedApplicationId) {
      setSnackbar({
        open: true,
        message: "Please select an application.",
        severity: "warning",
      });
      return;
    }

    const sourceHistoryId =
      selectedRowData?.historyDetails?.id || selectedRowData?.history_id;
    if (!sourceHistoryId) {
      setSnackbar({
        open: true,
        message: "The source history ID is missing. Please close and try again.",
        severity: "error",
      });
      return;
    }

    setIsMoving(true);
    try {
      const result = await moveContactHistoryToApplication({
        zoho: ZOHO,
        sourceHistoryId,
        targetMatterId: selectedApplicationId,
        listAttachments: zohoApi.file.getAttachments,
      });
      handleApplicationDialogClose();
      onMoveCompleted?.(result);
    } catch (error) {
      console.error("Error moving history:", error);
      setSnackbar({
        open: true,
        message: error?.message || "Failed to move history. Please try again.",
        severity: "error",
      });
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <>
      <MUIDialog
        open={openApplicationDialog}
        onClose={isMoving ? undefined : handleApplicationDialogClose}
        PaperProps={{
          sx: {
            minWidth: "600px",
            maxWidth: "800px",
            padding: "16px",
            fontSize: "9pt", // Global font size for the dialog
          },
        }}
      >
        <DialogContent sx={{ position: "relative" }}>
          {isMoving && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                zIndex: 1,
              }}
            >
              <CircularProgress size={48} />
            </Box>
          )}
          <ApplicationTable
            applications={applications}
            selectedApplicationId={selectedApplicationId}
            setSelectedApplicationId={setSelectedApplicationId}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleApplicationDialogClose}
            color="secondary"
            disabled={isMoving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApplicationSelect}
            color="primary"
            disabled={!selectedApplicationId || isMoving}
            startIcon={isMoving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isMoving ? "Moving..." : "Move"}
          </Button>
        </DialogActions>
      </MUIDialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ApplicationDialog;
