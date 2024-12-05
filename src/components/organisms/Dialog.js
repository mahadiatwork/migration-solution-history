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
import DialogTitle from "@mui/material/DialogTitle";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Typography from "@mui/material/Typography";
import Stakeholder from "../atoms/Stakeholder";
import { getResultOptions } from "./helperFunc";
import ContactField from "./ContactFields";
import RegardingField from "./RegardingField";


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
  currentContact
}) {

  const [contacts, setContacts] = React.useState([]);
  const [selectedContacts, setSelectedContacts] = React.useState([]);
  const [inputValue, setInputValue] = React.useState("");
  const [notFoundMessage, setNotFoundMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState("");
  const [type, setType] = React.useState("");
  const [historyName, setHistoryName] = React.useState("");
  const [mainHistoryData, setMainHistoryData] = React.useState(null);
  const [historyContacts, setHistoryContacts] = React.useState([]);
  const [duration, setDuration] = React.useState("");
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
      Duration: formData.duration ? String(formData.duration) : null, // Convert duration to string
      Date: formData.date_time
        ? dayjs(formData.date_time).format("YYYY-MM-DDTHH:mm:ssZ")
        : null,
    };

    try {
      let historyId;

      if (selectedRowData) {

        // Update the History1 record
        const updateConfig = {
          Entity: "History1",
          APIData: {
            id: selectedRowData.historyDetails.id,
            ...finalData,
          },
          Trigger: ["workflow"],
        };


        handleCloseDialog({
          id: selectedRowData.id,
          ...formData
        });
        const updateResponse = await ZOHO.CRM.API.updateRecord(updateConfig);
        if (updateResponse?.data[0]?.code === "SUCCESS") {
          historyId = selectedRowData.historyDetails.id; // Use the existing ID for the child record
          const updateConfig = {
            Entity: "History_X_Contacts",
            APIData: {
              id: selectedRowData?.id,
              History_Details: formData.details || "",
              History_Result: formData.result || "",
              History_Type: formData.type || "",
              Stakeholder: formData.stakeHolder ? { id: formData.stakeHolder.id } : null,
              Regarding: formData.regarding || "",
              History_Date_Time: formData.date_time
                ? dayjs(formData.date_time).format("YYYY-MM-DDTHH:mm:ssZ")
                : null,
              Contact_History_Info: { id: historyId }, // Reference the History1 record
            },
            Trigger: ["workflow"],
          };

          const updateResponse = await ZOHO.CRM.API.updateRecord(updateConfig);
          console.log({ updateResponse })
        } else {
          throw new Error("Failed to update History1 record.");
        }
      } else {
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
          historyId = createResponse.data[0].details.id; // Get the new ID
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
                Contact_Details: { id: contact.id }, // Reference the participant
                Contact_History_Info: { id: historyId }, // Reference the History1 record
              };

              const historyXContactsConfig = {
                Entity: "History_X_Contacts",
                APIData: historyXContactsData,
              };

              return ZOHO.CRM.API.insertRecord(historyXContactsConfig);
            });

            const historyXContactsResponses = await Promise.all(historyXContactsPromises);

            // Check for any errors in creating History_X_Contacts
            const failedContacts = historyXContactsResponses.filter(
              (response) => response?.data[0]?.code !== "SUCCESS"
            );
            if (failedContacts.length > 0) {
              throw new Error("Failed to create one or more History_X_Contacts records.");
            }
          }
        } else {
          throw new Error("Failed to create History1 record.");
        }
      }

      // Map form data to API field names for History_X_Contacts

      // Show success message
      setSnackbar({ open: true, message: "Record saved successfully!", severity: "success" });
    } catch (error) {
      console.error("Error saving records:", error);
      setSnackbar({ open: true, message: error.message || "An error occurred.", severity: "error" });
    } finally {
      handleCloseDialog();
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
            "& *": {
              fontSize: "9pt", // Apply 9pt globally
            },
          },
        }}
      >
        {/* <DialogTitle sx={{ fontSize: "16px" }}>{title}</DialogTitle> */}
        <DialogContent>
          {/* <Box></Box> */}
           <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="standard">
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => {
                    handleInputChange("type", e.target.value);
                    handleInputChange("result", getResultOptions(e.target.value));
                  }}
                  label="Type"
                >
                  {typeOptions.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="standard">
                <InputLabel>Result</InputLabel>
                <Select
                  value={formData.result}
                  onChange={(e) => handleInputChange("result", e.target.value)}
                  label="Result"
                >
                  {typeOptions.map((result) => (
                    <MenuItem key={result} value={result}>
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
          <Grid container>
            <Grid item xs={6}>
              <Box sx={{ width: "95%" }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DemoContainer components={["DateTimePicker"]}>
                    <DateTimePicker
                      id="date_time"
                      label="Date & Time"
                      name="date_time"
                      value={formData.date_time || dayjs()} // Initialize with current date if null
                      onChange={(newValue) => handleInputChange("date_time", newValue || dayjs())} // Update formData when date changes
                      format="DD/MM/YYYY hh:mm A"
                      sx={{ overflow: "hidden" }}
                      fullWidth
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
                onChange={(event, newValue) =>
                  handleInputChange("duration", newValue)
                }
                renderInput={(params) => (
                  <TextField {...params} label="Duration (Min)" variant="standard" sx={{ mt: 1 }} />
                )}
              />
            </Grid>
          </Grid>
          <Grid container>
            <Grid item xs={6}>
              <Box sx={{ width: "95%" }}>
                <Autocomplete
                  options={ownerList}
                  getOptionLabel={(option) => option.full_name || ""}
                  value={selectedOwner} // Default to loggedInUser if available
                  onChange={(event, newValue) => setSelectedOwner(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="Record Owner" name="history_owner" variant="standard" />
                  )}
                />
              </Box>
            </Grid>
            <Grid item xs={6}>
              <RegardingField
                formData={formData}
                handleInputChange={handleInputChange}
              />
            </Grid>
          </Grid>
          <Box sx={{ display: "flex", flexDirection: "column", width: "100%", mt: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>

              {/* TextField for File Name */}
              <TextField
                variant="standard"
                sx={{ flexGrow: 1 }}
                value={formData?.attachment?.name || ""}
                placeholder="No file selected"
                InputProps={{
                  readOnly: true,
                }}
              />

              {/* Attach Button */}
              <Button
                variant="outlined"
                size="small"
                component="label"
                sx={{
                  flexShrink: 0,
                  minWidth: "80px",
                  textTransform: "none",
                }}
              >
                Attachment
                <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleInputChange("attachment", file); // Update formData with selected file
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
              />
            </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} variant="outlined">
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Save
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
}
