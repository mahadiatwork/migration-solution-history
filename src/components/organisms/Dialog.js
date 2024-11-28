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

      setSelectedContacts(selectedRowData?.Participants || []);
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

  const handleContactSearch = async (query) => {
    setNotFoundMessage("");
    setLoading(true);

    if (ZOHO && query.trim()) {
      try {
        const searchResults = await ZOHO.CRM.API.searchRecord({
          Entity: "Contacts",
          Type: "word",
          Query: query.trim(),
        });

        if (searchResults.data && searchResults.data.length > 0) {
          const formattedContacts = searchResults.data.map((contact) => ({
            Full_Name: contact.Full_Name,
            id: contact.id,
          }));

          setContacts([...formattedContacts, ...selectedContacts]);
          setNotFoundMessage("");
        } else {
          setNotFoundMessage(`"${query}" not found in the database`);
        }
      } catch (error) {
        console.error("Error during search:", error);
        setNotFoundMessage("An error occurred while searching. Please try again.");
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const handleInputChangeWithDelay = (event, newInputValue) => {
    setInputValue(newInputValue);
    setNotFoundMessage("");
    if (newInputValue.endsWith(" ")) {
      handleContactSearch(newInputValue);
    }
  };

  const handleSelectionChange = (event, newValue) => {
    setSelectedContacts(newValue);
  };

  const handleRegardingChange = (event) => {
    setRegarding(event.target.value); // Update the state with user input
  };


  React.useEffect(() => {
    const names = selectedContacts.map((contact) => contact.Full_Name).join(", ");
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



  return (
    <>
      <MUIDialog
        open={openDialog}
        onClose={handleCloseDialog}
        PaperProps={{
          component: "form",
          onSubmit: handleSubmit,
          sx: { minWidth: "60%" },
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Autocomplete
                multiple
                options={contacts}
                getOptionLabel={(option) => option.Full_Name || ""}
                value={selectedContacts}
                onChange={handleSelectionChange}
                inputValue={inputValue}
                onInputChange={handleInputChangeWithDelay}
                loading={loading}
                noOptionsText={
                  notFoundMessage ? (
                    <Box display="flex" alignItems="center" color="error.main">
                      <ErrorOutlineIcon sx={{ mr: 1 }} />
                      <Typography variant="body2">{notFoundMessage}</Typography>
                    </Box>
                  ) : (
                    "No options"
                  )
                }
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip label={option.Full_Name} {...getTagProps({ index })} />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Participants"
                    variant="standard"
                    placeholder="Add participants"
                  />
                )}
              />
              <Autocomplete
                options={durationOptions}
                getOptionLabel={(option) => option.toString()}
                value={formData?.duration}
                onChange={(event, newValue) =>
                  handleInputChange("duration", newValue)
                }
                renderInput={(params) => (
                  <TextField {...params} label="Duration (Min)" variant="standard" />
                )}
              />
              <TextField
                margin="dense"
                id="history_details"
                name="history_details"
                label="History Details"
                fullWidth
                multiline
                variant="standard"
                defaultValue={formData?.details || ""}
                onChange={(e) => handleInputChange("details", e.target.value)}
              />
              <TextField
                margin="dense"
                id="regarding"
                name="regarding"
                label="Regarding"
                fullWidth
                variant="standard"
                value={formData?.regarding}
                onChange={(e) => handleInputChange("regarding", e.target.value)}
              />

              <TextField
                margin="dense"
                id="history_name"
                name="history_name"
                label="History Name"
                fullWidth
                variant="standard"
                value={historyName}
                InputProps={{ readOnly: true }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DemoContainer components={["DateTimePicker"]}>
                  <DateTimePicker
                    id="date_time"
                    label="Date"
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
              <Autocomplete
                options={ownerList}
                getOptionLabel={(option) => option.full_name || ""}
                value={selectedOwner} // Default to loggedInUser if available
                onChange={(event, newValue) => setSelectedOwner(newValue)}
                renderInput={(params) => (
                  <TextField {...params} label="History Owner" name="history_owner" variant="standard" />
                )}
              />

              <FormControl fullWidth variant="standard" sx={{ marginTop: 1 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => {
                    handleInputChange("type", e.target.value)
                    handleInputChange("result", getResultOptions(e.target.value))
                  }}
                  label="Type"
                >
                  <MenuItem value="Meeting">Meeting</MenuItem>
                  <MenuItem value="To-Do">To-Do</MenuItem>
                  <MenuItem value="Appointment">Appointment</MenuItem>
                  <MenuItem value="Boardroom">Boardroom</MenuItem>
                  <MenuItem value="Call Billing">Call Billing</MenuItem>
                  <MenuItem value="Email Billing">Email Billing</MenuItem>
                  <MenuItem value="Initial Consultation">Initial Consultation</MenuItem>
                  <MenuItem value="Call">Call</MenuItem>
                  <MenuItem value="Mail">Mail</MenuItem>
                  <MenuItem value="Meeting Billing">Meeting Billing</MenuItem>
                  <MenuItem value="Personal Activity">Personal Activity</MenuItem>
                  <MenuItem value="Room 1">Room 1</MenuItem>
                  <MenuItem value="Room 2">Room 2</MenuItem>
                  <MenuItem value="Room 3">Room 3</MenuItem>
                  <MenuItem value="To Do Billing">To Do Billing</MenuItem>
                  <MenuItem value="Vacation">Vacation</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth variant="standard" sx={{ marginTop: 1 }}>
                <InputLabel>Result</InputLabel>
                <Select
                  value={formData.result}
                  onChange={(e) => handleInputChange("result", e.target.value)}
                  label="Result"
                >
                  <MenuItem value="Call Attempted">Call Attempted</MenuItem>
                  <MenuItem value="Call Completed">Call Completed</MenuItem>
                  <MenuItem value="Call Left Message">Call Left Message</MenuItem>
                  <MenuItem value="Call Received">Call Received</MenuItem>
                  <MenuItem value="Meeting Held">Meeting Held</MenuItem>
                  <MenuItem value="Meeting Not Held">Meeting Not Held</MenuItem>
                  <MenuItem value="To-do Done">To-do Done</MenuItem>
                  <MenuItem value="To-do Not Done">To-do Not Done</MenuItem>
                  <MenuItem value="Appointment Completed">Appointment Completed</MenuItem>
                  <MenuItem value="Appointment Not Completed">Appointment Not Completed</MenuItem>
                  <MenuItem value="Boardroom - Completed">Boardroom - Completed</MenuItem>
                  <MenuItem value="Boardroom - Not Completed">Boardroom - Not Completed</MenuItem>
                  <MenuItem value="Call Billing - Completed">Call Billing - Completed</MenuItem>
                  <MenuItem value="Initial Consultation - Completed">Initial Consultation - Completed</MenuItem>
                  <MenuItem value="Initial Consultation - Not Completed">Initial Consultation - Not Completed</MenuItem>
                  <MenuItem value="Mail - Completed">Mail - Completed</MenuItem>
                  <MenuItem value="Mail - Not Completed">Mail - Not Completed</MenuItem>
                  <MenuItem value="Meeting Billing - Completed">Meeting Billing - Completed</MenuItem>
                  <MenuItem value="Meeting Billing - Not Completed">Meeting Billing - Not Completed</MenuItem>
                  <MenuItem value="Personal Activity - Completed">Personal Activity - Completed</MenuItem>
                  <MenuItem value="Personal Activity - Not Completed">Personal Activity - Not Completed</MenuItem>
                  <MenuItem value="Note">Note</MenuItem>
                  <MenuItem value="Mail Received">Mail Received</MenuItem>
                  <MenuItem value="Mail Sent">Mail Sent</MenuItem>
                  <MenuItem value="Email Received">Email Received</MenuItem>
                  <MenuItem value="Courier Sent">Courier Sent</MenuItem>
                  <MenuItem value="Email Sent">Email Sent</MenuItem>
                  <MenuItem value="Payment Received">Payment Received</MenuItem>
                  <MenuItem value="Room 1 - Completed">Room 1 - Completed</MenuItem>
                  <MenuItem value="Room 1 - Not Completed">Room 1 - Not Completed</MenuItem>
                  <MenuItem value="Room 2 - Completed">Room 2 - Completed</MenuItem>
                  <MenuItem value="Room 2 - Not Completed">Room 2 - Not Completed</MenuItem>
                  <MenuItem value="Room 3 - Completed">Room 3 - Completed</MenuItem>
                  <MenuItem value="Room 3 - Not Completed">Room 3 - Not Completed</MenuItem>
                  <MenuItem value="To Do Billing - Completed">To Do Billing - Completed</MenuItem>
                  <MenuItem value="To Do Billing - Not Completed">To Do Billing - Not Completed</MenuItem>
                  <MenuItem value="Vacation - Completed">Vacation - Completed</MenuItem>
                  <MenuItem value="Vacation - Not Completed">Vacation - Not Completed</MenuItem>
                  <MenuItem value="Vacation Cancelled">Vacation Cancelled</MenuItem>
                  <MenuItem value="Attachment">Attachment</MenuItem>
                  <MenuItem value="E-mail Attachment">E-mail Attachment</MenuItem>
                </Select>
              </FormControl>


              <Stakeholder
                key={formData?.stakeHolder?.id || "new-dialog"} // Use a unique key for each stakeholder
                formData={formData}
                handleInputChange={handleInputChange}
                ZOHO={ZOHO}
                selectedRowData={selectedRowData}
              />
            </Box>
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
