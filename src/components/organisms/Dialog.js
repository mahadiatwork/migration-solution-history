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
  obj,
  title,
  ownerList,
  loggedInUser,
  ZOHO, // Zoho instance for API calls
  selectedRowData,
}) {
  const [contacts, setContacts] = React.useState([]);
  const [selectedContacts, setSelectedContacts] = React.useState(
    selectedRowData?.Participants || []
  );
  const [inputValue, setInputValue] = React.useState("");
  const [notFoundMessage, setNotFoundMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState(obj?.result || "");
  const [type, setType] = React.useState(obj?.type || "");
  const [historyName, setHistoryName] = React.useState("");

  const [mainHistoryData, setMainHistoryData] = React.useState(null);
  const [historyContacts, setHistoryContacts] = React.useState([]);
  const [duration, setDuration] = React.useState(obj?.duration || ""); // Default

  React.useEffect(() => {
    const fetchHistoryData = async () => {
      console.log("Fetching history data for ID:", obj?.historyId);
      if (obj?.historyId) {
        try {
          const data = await ZOHO.CRM.API.getRelatedRecords({
            Entity: "History1",
            RecordID: obj.historyId,
            RelatedList: "Contacts3",
            page: 1,
            per_page: 200,
          });

          // Map over the data array to extract only necessary contact details
          const contactDetailsArray = data.data.map(record => ({
            Full_Name: record.Contact_Details.name, // Use Full_Name key to match contacts structure
            id: record.Contact_Details.id,
          }));

          console.log("related contacts", contactDetailsArray);
          setHistoryContacts(contactDetailsArray);
          setSelectedContacts(contactDetailsArray); // Set initial selected contacts
        } catch (error) {
          console.error("Error fetching related contacts:", error);
        }
      }
    };

    fetchHistoryData();
  }, [obj?.historyId]);


  const handleSearch = async (query) => {
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
      handleSearch(newInputValue);
    }
  };

  const handleSelectionChange = (event, newValue) => {
    setSelectedContacts(newValue);
  };

  console.log("Main history data", mainHistoryData);

  // Update historyName whenever selectedContacts changes
  React.useEffect(() => {
    const names = selectedContacts.map(contact => contact.Full_Name).join(", ");
    setHistoryName(names);
  }, [selectedContacts]);

  React.useEffect(() => {
    if (type in resultMapping) {
      setResult(resultMapping[type]);
    }
  }, [type]);

  return (
    <MUIDialog
      open={openDialog}
      onClose={handleCloseDialog}
      PaperProps={{
        component: "form",
        onSubmit: (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const formJson = Object.fromEntries(formData.entries());
          const date_time = dayjs(formJson.date_time).format("YYYY-MM-DDTHH:mm:ssZ");

          console.log(formJson);

          handleCloseDialog();
        },
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
              value={selectedContacts} // Set selected contacts here
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
                  label="Contact Details"
                  variant="standard"
                  placeholder="Type and press space to search..."
                />
              )}
            />
            <Autocomplete
              options={durationOptions}
              getOptionLabel={(option) => option.toString()}
              value={duration}
              onChange={(event, newValue) => setDuration(newValue)} // Update the duration state
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
              defaultValue={obj?.details || ""}
            />
            <TextField
              margin="dense"
              id="regarding"
              name="regarding"
              label="Regarding"
              fullWidth
              variant="standard"
              value={obj?.regarding || ""}
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
                  value={dayjs(obj?.date_time)}
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
              id="history_owner"
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="History Owner"
                  name="history_owner"
                  variant="standard"
                />
              )}
            />
              <FormControl fullWidth variant="standard" sx={{ marginTop: 1 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
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
              value={result}
              onChange={(e) => setResult(e.target.value)}
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


            <TextField
              margin="dense"
              id="stakeholder"
              name="stakeholder"
              label="Stakeholder"
              fullWidth
              variant="standard"
              value={obj?.stakeholder || ""}
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
  );
}
