import * as React from "react";
import dayjs from "dayjs";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import {
  Autocomplete,
  TextField,
  Dialog as MUIDialog,
  Select,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  Grid,
} from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { getResultOptions } from "./helperFunc";
import ContactField from "./ContactFields";
import RegardingField from "./RegardingField";
import DownloadIcon from '@mui/icons-material/Download';


const debounce = (func, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};


const durationOptions = Array.from({ length: 24 }, (_, i) => (i + 1) * 10);

const resultMapping = {
  "Meeting": "Meeting Held",
  "To-Do": "To-do Done",
  "Appointment": "Appointment Completed",
  "Boardroom": "Boardroom - Completed",
  "Call Billing": "Call Billing - Completed",
  "Email Billing": "Mail - Completed",
  "Initial Consultation": "Initial Consultation - Completed",
  "Call": "Call Completed",
  "Mail": "Mail Sent",
  "Meeting Billing": "Meeting Billing - Completed",
  "Personal Activity": "Personal Activity - Completed",
  "Room 1": "Room 1 - Completed",
  "Room 2": "Room 2 - Completed",
  "Room 3": "Room 3 - Completed",
  "To Do Billing": "To Do Billing - Completed",
  "Vacation": "Vacation - Completed",
};

export function Dialog({
  openDialog,
  handleCloseDialog,
  title,
  ownerList,
  loggedInUser,
  ZOHO, // Zoho instance for API calls
  selectedRowData,
  currentContact,
  onRecordAdded
}) {

  const [selectedContacts, setSelectedContacts] = React.useState([]);
  const [historyName, setHistoryName] = React.useState("");
  const [historyContacts, setHistoryContacts] = React.useState([]);
  const [selectedOwner, setSelectedOwner] = React.useState(loggedInUser || null);
  const [regarding, setRegarding] = React.useState(selectedRowData?.regarding || "");
  const [formData, setFormData] = React.useState(selectedRowData || {}); // Form data state
  const [snackbar, setSnackbar] = React.useState({ open: false, message: "", severity: "success" });


  // Reinitialize dialog state when `openDialog` or `obj` changes
  React.useEffect(() => {
    if (openDialog) {
      setFormData({
        ...selectedRowData,
        Participants: selectedRowData?.Participants || [],
        result: selectedRowData?.result || "",
        type: selectedRowData?.type || "",
        duration: selectedRowData?.duration || "",
        regarding: selectedRowData?.regarding || "",
        details: selectedRowData?.details || "",
        stakeHolder: selectedRowData?.stakeHolder || null,
        date_time: selectedRowData?.date_time ? dayjs(selectedRowData.date_time) : dayjs(), // Initialize with the current date
      });

      setSelectedContacts(selectedRowData?.Participants || [currentContact] || []);
      setHistoryName(
        selectedRowData?.Participants?.map((p) => p.Full_Name).join(", ") || ""
      );
      setSelectedOwner(loggedInUser || null);
    }
  }, [openDialog, selectedRowData, loggedInUser]);


  React.useEffect(() => {
    const fetchHistoryData = async () => {
      if (selectedRowData?.historyDetails) {
        try {
          const data = await ZOHO.CRM.API.getRelatedRecords({
            Entity: "History1",
            RecordID: selectedRowData?.historyDetails?.id,
            RelatedList: "Contacts3",
            page: 1,
            per_page: 200,
          });

          const contactDetailsArray = data.data.map((record) => ({
            Full_Name: record.Contact_Details.name,
            id: record.Contact_Details.id,
          }));

          setHistoryContacts(contactDetailsArray);
          setSelectedContacts(contactDetailsArray);
        } catch (error) {
          console.error("Error fetching related contacts:", error);
        }
      }
    };

    if (openDialog) {
      fetchHistoryData();
    }
  }, [selectedRowData?.historyDetails, openDialog]);


  const handleRegardingChange = (event) => {
    setRegarding(event.target.value); // Update the state with user input
  };


  React.useEffect(() => {
    const names = selectedContacts.map((contact) => contact?.Full_Name).join(", ");
    setHistoryName(names);
  }, [selectedContacts]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };



  const handleSubmit = async (event) => {
    event.preventDefault();

    // Map form data to API field names for History1
    const finalData = {
      Name: historyName,
      History_Details_Plain: formData.details,
      Regarding: formData.regarding,
      Owner: selectedOwner
        ? {
          id: selectedOwner.id,
          full_name: selectedOwner.full_name,
          email: selectedOwner.email,
        }
        : null,
      History_Result: formData.result || "",
      Stakeholder: formData.stakeHolder ? { id: formData.stakeHolder.id } : null,
      History_Type: formData.type || "",
      Duration: formData.duration ? String(formData.duration) : null,
      Date: formData.date_time
        ? dayjs(formData.date_time).format("YYYY-MM-DDTHH:mm:ssZ")
        : null,
    };

    try {
      let historyId;

      if (!selectedRowData) {
        // Create a new History1 record
        const createConfig = {
          Entity: "History1",
          APIData: {
            ...finalData,
          },
          Trigger: ["workflow"],
        };

        const createResponse = await ZOHO.CRM.API.insertRecord(createConfig);
        if (createResponse?.data[0]?.code === "SUCCESS") {
          historyId = createResponse.data[0].details.id;

          // Prepare the new record for the table
          const newRecord = {
            name: finalData.Name,
            id: historyId,
            date_time: finalData.Date,
            type: finalData.History_Type,
            result: finalData.History_Result,
            duration: finalData.Duration,
            regarding: finalData.Regarding,
            details: finalData.History_Details_Plain,
            icon: <DownloadIcon />, // Use the same icon setup
            ownerName: finalData.Owner?.full_name || "",
          };

          // Pass the new record to the parent using the callback
          onRecordAdded(newRecord);

          if (historyId) {
            const historyXContactsPromises = selectedContacts.map((contact) => {
              const historyXContactsData = {
                History_Details: formData.details || "",
                History_Result: formData.result || "",
                History_Type: formData.type || "",
                Stakeholder: formData.stakeHolder ? { id: formData.stakeHolder.id } : null,
                Regarding: formData.regarding || "",
                History_Date_Time: formData.date_time
                  ? dayjs(formData.date_time).format("YYYY-MM-DDTHH:mm:ssZ")
                  : null,
                Contact_Details: { id: contact.id },
                Contact_History_Info: { id: historyId },
              };

              const historyXContactsConfig = {
                Entity: "History_X_Contacts",
                APIData: historyXContactsData,
              };

              return ZOHO.CRM.API.insertRecord(historyXContactsConfig);
            });

            await Promise.all(historyXContactsPromises);
          }
        } else {
          throw new Error("Failed to create History1 record.");
        }
      }

      // Show success message
      setSnackbar({ open: true, message: "Record saved successfully!", severity: "success" });
    } catch (error) {
      console.error("Error saving records:", error);
      setSnackbar({ open: true, message: error.message || "An error occurred.", severity: "error" });
    } finally {
      handleCloseDialog();
    }
  };


  const handleDelete = async () => {
    if (!selectedRowData) return; // No record selected

    try {
      // Delete related records first
      if (selectedRowData?.historyDetails) {
        const relatedRecordsResponse = await ZOHO.CRM.API.getRelatedRecords({
          Entity: "History1",
          RecordID: selectedRowData?.historyDetails?.id,
          RelatedList: "Contacts3",
        });
        const relatedRecords = relatedRecordsResponse?.data || [];
        const deletePromises = relatedRecords.map((record) =>
          ZOHO.CRM.API.deleteRecord({
            Entity: "History_X_Contacts",
            RecordID: record.id,
          })
        );


        await Promise.all(deletePromises);
      }

      // Delete the main record
      const response = await ZOHO.CRM.API.deleteRecord({
        Entity: "History1",
        RecordID: selectedRowData?.historyDetails?.id,
      });

      if (response?.data[0]?.code === "SUCCESS") {
        setSnackbar({
          open: true,
          message: "Record and related records deleted successfully!",
          severity: "success",
        });

        // Notify parent to remove the record from the table
        handleCloseDialog({ deleted: true, id: selectedRowData.id });
        window.location.reload();
      } else {
        throw new Error("Failed to delete record.");
      }
    } catch (error) {
      console.error("Error deleting record or related records:", error);
      setSnackbar({ open: true, message: "Error deleting records.", severity: "error" });
    }
  };



  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: "", severity: "success" });
  };

  const typeOptions = [
    "Meeting",
    "To-Do",
    "Appointment",
    "Boardroom",
    "Call Billing",
    "Email Billing",
    "Initial Consultation",
    "Call",
    "Mail",
    "Meeting Billing",
    "Personal Activity",
    "Room 1",
    "Room 2",
    "Room 3",
    "To Do Billing",
    "Vacation",
    "Other"
  ];

  const resultOptions = [
    "Call Attempted",
    "Call Completed",
    "Call Left Message",
    "Call Received",
    "Meeting Held",
    "Meeting Not Held",
    "To-do Done",
    "To-do Not Done",
    "Appointment Completed",
    "Appointment Not Completed",
    "Boardroom - Completed",
    "Boardroom - Not Completed",
    "Call Billing - Completed",
    "Initial Consultation - Completed",
    "Initial Consultation - Not Completed",
    "Mail - Completed",
    "Mail - Not Completed",
    "Meeting Billing - Completed",
    "Meeting Billing - Not Completed",
    "Personal Activity - Completed",
    "Personal Activity - Not Completed",
    "Note",
    "Mail Received",
    "Mail Sent",
    "Email Received",
    "Courier Sent",
    "Email Sent",
    "Payment Received",
    "Room 1 - Completed",
    "Room 1 - Not Completed",
    "Room 2 - Completed",
    "Room 2 - Not Completed",
    "Room 3 - Completed",
    "Room 3 - Not Completed",
    "To Do Billing - Completed",
    "To Do Billing - Not Completed",
    "Vacation - Completed",
    "Vacation - Not Completed",
    "Vacation Cancelled",
    "Attachment",
    "E-mail Attachment",
  ];

  return (
    <>
      <MUIDialog
        open={openDialog}
        onClose={handleCloseDialog}
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit,
          sx: {
            minWidth: "60%",
            maxHeight: "90vh", // Prevent scrolling
            overflow: "hidden", // Hide overflow if content exceeds
            "& *": {
              fontSize: "9pt", // Apply 9pt globally
            },
          },
        }}
      >
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: "8px", // Reduce spacing between fields
          }}
        >
          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="standard" sx={{ fontSize: "9pt" }}>
                <InputLabel sx={{ fontSize: "9pt" }}>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => {
                    handleInputChange("type", e.target.value);
                    handleInputChange("result", getResultOptions(e.target.value));
                  }}
                  label="Type"
                  sx={{
                    "& .MuiSelect-select": {
                      fontSize: "9pt",
                    },
                  }}
                >
                  {typeOptions.map((type) => (
                    <MenuItem key={type} value={type} sx={{ fontSize: "9pt" }}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="standard" sx={{ fontSize: "9pt" }}>
                <InputLabel sx={{ fontSize: "9pt" }}>Result</InputLabel>
                <Select
                  value={formData.result}
                  onChange={(e) => handleInputChange("result", e.target.value)}
                  label="Result"
                  sx={{
                    "& .MuiSelect-select": {
                      fontSize: "9pt",
                    },
                  }}
                >
                  {resultOptions.map((result) => (
                    <MenuItem key={result} value={result} sx={{ fontSize: "9pt" }}>
                      {result}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <ContactField
            handleInputChange={handleInputChange}
            ZOHO={ZOHO}
            selectedRowData={selectedRowData}
            currentContact={currentContact}
            selectedContacts={historyContacts}
          />

          <Grid container spacing={1}>
            <Grid
              item
              xs={6}
              sx={{
                overflow: "hidden", // Ensure the grid container doesn't allow overflow
                width: "98%"
              }}
            >
              <Box sx={{ width: "99%", mt: -1 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DemoContainer
                    components={["DateTimePicker"]}
                    sx={{
                      overflow: "hidden", // Prevent overflow in the DemoContainer
                    }}
                  >
                    <DateTimePicker
                      id="date_time"
                      label="Date & Time"
                      name="date_time"
                      value={formData.date_time || dayjs()}
                      onChange={(newValue) =>
                        handleInputChange("date_time", newValue || dayjs())
                      }
                      format="DD/MM/YYYY hh:mm A"
                      sx={{
                        "& .MuiInputBase-input": {
                          fontSize: "9pt",
                        },
                        overflow: "hidden", // Prevent overflow in the DateTimePicker
                      }}
                      slotProps={{
                        textField: { variant: "standard", margin: "dense" },
                      }}
                    />
                  </DemoContainer>
                </LocalizationProvider>
              </Box>
            </Grid>


            <Grid item xs={6}>
              <Autocomplete
                options={durationOptions}
                getOptionLabel={(option) => option.toString()}
                value={formData?.duration}
                onChange={(event, newValue) => handleInputChange("duration", newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Duration (Min)"
                    variant="standard"
                    sx={{
                      "& .MuiInputBase-input": {
                        fontSize: "9pt", // Font size for the input
                      },
                      "& .MuiInputLabel-root": {
                        fontSize: "9pt", // Font size for the label
                      },
                      "& .MuiFormHelperText-root": {
                        fontSize: "9pt", // Font size for helper text (if any)
                      },
                    }}
                  />
                )}
                sx={{
                  "& .MuiAutocomplete-option": {
                    fontSize: "9pt", // Font size for dropdown options
                  },
                  "& .MuiAutocomplete-input": {
                    fontSize: "9pt", // Font size for the input field inside the Autocomplete
                  },
                }}
              />

            </Grid>
          </Grid>

          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Autocomplete
                options={ownerList}
                getOptionLabel={(option) => option.full_name || ""}
                value={selectedOwner}
                onChange={(event, newValue) => setSelectedOwner(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Record Owner"
                    name="history_owner"
                    variant="standard"
                    sx={{
                      "& .MuiInputBase-input": {
                        fontSize: "9pt",
                      },
                    }}
                  />
                )}
              />
            </Grid>
            <Grid item xs={6}>
              <RegardingField
                formData={formData}
                handleInputChange={handleInputChange}
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              mt: 2,
              fontSize: "9pt",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                width: "100%",
              }}
            >
              <TextField
                variant="standard"
                sx={{
                  flexGrow: 1,
                  "& .MuiInputBase-input": {
                    fontSize: "9pt",
                  },
                }}
                value={formData?.attachment?.name || ""}
                placeholder="No file selected"
                InputProps={{
                  readOnly: true,
                }}
              />

              <Button
                variant="outlined"
                size="small"
                component="label"
                sx={{
                  flexShrink: 0,
                  minWidth: "80px",
                  textTransform: "none",
                  fontSize: "9pt",
                }}
              >
                Attachment
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleInputChange("attachment", file);
                    }
                  }}
                />
              </Button>
            </Box>
          </Box>

          <Box>
            <TextField
              margin="dense"
              id="history_details"
              name="history_details"
              label="History Details"
              fullWidth
              multiline
              variant="standard"
              minRows={3}
              defaultValue={formData?.details || ""}
              onChange={(e) => handleInputChange("details", e.target.value)}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "9pt",
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ display: "flex", justifyContent: "space-between" }}>
          <Button
            onClick={handleDelete}
            variant="outlined"
            color="error"
            sx={{
              fontSize: "9pt",
              marginLeft: "8px",
              textTransform: "none",
              padding: "4px 8px",
            }}
          >
            Delete
          </Button>
          <Box sx={{display: "flex", gap: 1}}>          <Button
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{ fontSize: "9pt" }}
          >
            Cancel
          </Button>
            <Button type="submit" variant="contained" sx={{ fontSize: "9pt" }}>
              Save
            </Button></Box>
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
}
