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
  InputAdornment,
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
import IconButton from "@mui/material/IconButton"; // For the clickable icon button
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"; // For the calendar icon
import { styled } from "@mui/material/styles";
import { zohoApi } from "../../zohoApi";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

const debounce = (func, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func(...args), delay);
  };
};

const durationOptions = Array.from({ length: 24 }, (_, i) => (i + 1) * 10);

const resultMapping = {
  Meeting: "Meeting Held",
  "To-Do": "To-do Done",
  Appointment: "Appointment Completed",
  Boardroom: "Boardroom - Completed",
  "Call Billing": "Call Billing - Completed",
  "Email Billing": "Mail - Completed",
  "Initial Consultation": "Initial Consultation - Completed",
  Call: "Call Completed",
  Mail: "Mail Sent",
  "Meeting Billing": "Meeting Billing - Completed",
  "Personal Activity": "Personal Activity - Completed",
  "Room 1": "Room 1 - Completed",
  "Room 2": "Room 2 - Completed",
  "Room 3": "Room 3 - Completed",
  "To Do Billing": "To Do Billing - Completed",
  Vacation: "Vacation - Completed",
};

const typeMapping = Object.fromEntries(
  Object.entries(resultMapping).map(([type, result]) => [result, type])
);

export function Dialog({
  openDialog,
  handleCloseDialog,
  title,
  ownerList,
  loggedInUser,
  ZOHO, // Zoho instance for API calls
  selectedRowData,
  currentContact,
  onRecordAdded,
  selectedContacts,
  setSelectedContacts,
  buttonText = "Save",
}) {
  const [historyName, setHistoryName] = React.useState("");
  const [historyContacts, setHistoryContacts] = React.useState([]);
  const [selectedOwner, setSelectedOwner] = React.useState(
    loggedInUser || null
  );
  const [loadedAttachmentFromRecord, setLoadedAttachmentFromRecord] =
    React.useState();
  const [regarding, setRegarding] = React.useState(
    selectedRowData?.regarding || ""
  );
  const [formData, setFormData] = React.useState(selectedRowData || {}); // Form data state
  // console.log({ formData });
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleSelectFile = async (e) => {
    e.preventDefault();
    if ([...e.target.files]?.length > 1) {
      return;
    }
    if (e.target.files) {
      const el = [...e?.target?.files]?.[0];
      if (el) {
        handleInputChange("attachment", el);
      }
    }
  };

  React.useEffect(() => {
    let load = true;
    const getAttachment = async ({ rowData }) => {
      const { data } = await zohoApi.file.getAttachments({
        module: "History1",
        recordId: rowData?.historyDetails?.id,
      });
      setFormData((prev) => ({
        ...prev,
        attachment: { name: data?.[0]?.File_Name },
      }));
      setLoadedAttachmentFromRecord(data);
    };
    if (selectedRowData?.id && load) {
      load = false;
      getAttachment({ rowData: selectedRowData });
      // getAttachment({
      //   selectedRowData: { historyDetails: { id: "76775000001772113" } },
      // });
    }
  }, [selectedRowData]);

  // console.log({ selectedRowData })

  // Reinitialize dialog state when `openDialog` or `obj` changes
  React.useEffect(() => {
    if (openDialog) {
      setFormData({
        Participants: selectedRowData?.Participants || [],
        result: selectedRowData?.result || "Meeting Held",
        type: selectedRowData?.type || "Meeting",
        duration: selectedRowData?.duration || "60",
        regarding: selectedRowData?.regarding || "",
        details: selectedRowData?.details || "",
        stakeHolder: selectedRowData?.stakeHolder || null,
        date_time: selectedRowData?.date_time
          ? dayjs(selectedRowData.date_time)
          : dayjs(),
      });
      setSelectedContacts(
        selectedRowData?.Participants || [currentContact] || []
      );
      setHistoryName(
        selectedRowData?.Participants?.map((p) => p.Full_Name).join(", ") || ""
      );
      setSelectedOwner(loggedInUser || null);

      setHistoryContacts(selectedRowData?.Participants || []);
    } else {
      // Reset formData to avoid stale data
      setFormData({});
    }
  }, [openDialog, selectedRowData, loggedInUser, currentContact]);

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
          setFormData((prevFormData) => ({
            ...prevFormData, // Spread the previous formData
            Participants: contactDetailsArray, // Update only the Participants field
          }));
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
    const names = selectedContacts
      .map((contact) => contact?.Full_Name)
      .join(", ");
    setHistoryName(names);
  }, [selectedContacts]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    let selectedParticipants = [];

    if (formData.Participants) {
      selectedParticipants = formData.Participants;
    }

    if (selectedParticipants.length === 0) {
      selectedParticipants = [currentContact];
    }

    // Generate history name based on selected contacts
    const updatedHistoryName = selectedParticipants
      .map((c) => c.Full_Name)
      .join(", ");
    const finalData = {
      Name: updatedHistoryName,
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
      Stakeholder: formData.stakeHolder
        ? { id: formData.stakeHolder.id }
        : null,
      History_Type: formData.type || "",
      Duration: formData.duration ? String(formData.duration) : null,
      Date: formData.date_time
        ? dayjs(formData.date_time).format("YYYY-MM-DDTHH:mm:ssZ")
        : null,
    };

    console.log("data before updating", finalData);

    try {
      if (selectedRowData) {
        await updateHistory(selectedRowData, finalData, selectedParticipants);
      } else {
        await createHistory(finalData, selectedParticipants);
      }
    } catch (error) {
      console.error("Error saving records:", error);
      setSnackbar({
        open: true,
        message: error.message || "An error occurred.",
        severity: "error",
      });
    } finally {
      handleCloseDialog();
    }
  };

  const createHistory = async (finalData, selectedParticipants) => {
    try {
      const createConfig = {
        Entity: "History1",
        APIData: {
          ...finalData,
        },
        Trigger: ["workflow"],
      };

      // Create the History1 record
      const createResponse = await ZOHO.CRM.API.insertRecord(createConfig);
      if (createResponse?.data[0]?.code === "SUCCESS") {
        const historyId = createResponse.data[0].details.id;
        if (formData?.attachment) {
          const fileResp = await zohoApi.file.uploadAttachment({
            module: "History1",
            recordId: historyId,
            data: formData?.attachment,
          });
          // console.log({ fileResp });
        }

        let contactRecordIds = [];

        // Create History_X_Contacts records for each contact
        for (const contact of selectedParticipants) {
          try {
            const contactResponse = await ZOHO.CRM.API.insertRecord({
              Entity: "History_X_Contacts",
              APIData: {
                Contact_History_Info: { id: historyId },
                Contact_Details: { id: contact.id },
              },
              Trigger: ["workflow"],
            });

            // Collect the ID from the insertion response
            if (contactResponse?.data[0]?.code === "SUCCESS") {
              contactRecordIds.push(contactResponse.data[0].details.id);
            } else {
              console.warn(
                `Failed to insert History_X_Contacts record for contact ID ${contact.id}`
              );
            }
          } catch (error) {
            console.error(
              `Error inserting History_X_Contacts record for contact ID ${contact.id}:`,
              error
            );
          }
        }

        setSnackbar({
          open: true,
          message: "Record created successfully!",
          severity: "success",
        });

        // Notify parent about the created record
        const updatedRecord = {
          id: contactRecordIds[0] || null, // Set the first inserted History_X_Contacts ID (or null if none succeeded)
          ...finalData,
          Participants: selectedParticipants,
          historyDetails: {
            name: selectedParticipants.map((c) => c.Full_Name).join(", "),
            id: historyId, // Add the History1 record ID to historyDetails
          },
        };

        if (onRecordAdded) onRecordAdded(updatedRecord);
      } else {
        throw new Error("Failed to create History1 record.");
      }
    } catch (error) {
      console.error("Error creating history:", error);
      throw error;
    }
  };

  const updateHistory = async (
    selectedRowData,
    finalData,
    selectedParticipants
  ) => {
    try {
      const updateConfig = {
        Entity: "History1",
        RecordID: selectedRowData?.historyDetails?.id,
        APIData: {
          id: selectedRowData?.historyDetails?.id,
          ...finalData,
        },
        Trigger: ["workflow"],
      };

      const updateResponse = await ZOHO.CRM.API.updateRecord(updateConfig);
      if (updateResponse?.data[0]?.code === "SUCCESS") {
        const historyId = selectedRowData?.historyDetails?.id;

        // Delete attachment
        const deleteFileResp = await zohoApi.file.deleteAttachment({
          module: "History1",
          recordId: selectedRowData?.historyDetails?.id,
          attachment_id: loadedAttachmentFromRecord?.[0]?.id,
        });

        // Add new attachment
        const uploadFileResp = await zohoApi.file.uploadAttachment({
          module: "History1",
          recordId: historyId,
          data: formData?.attachment,
        });

        // Fetch existing History_X_Contacts records
        const relatedRecordsResponse = await ZOHO.CRM.API.getRelatedRecords({
          Entity: "History1",
          RecordID: historyId,
          RelatedList: "Contacts3",
        });

        const existingContacts = relatedRecordsResponse?.data || [];
        const existingContactIds = existingContacts.map(
          (contact) => contact.Contact_Details?.id
        );

        // Find contacts to add and to delete
        const selectedContactIds = selectedParticipants.map((c) => c.id);
        const toDeleteContactIds = existingContactIds.filter(
          (id) => !selectedContactIds.includes(id)
        );
        const toAddContacts = selectedParticipants.filter(
          (contact) => !existingContactIds.includes(contact.id)
        );

        // Delete records for removed contacts
        for (const id of toDeleteContactIds) {
          const recordToDelete = existingContacts.find(
            (contact) => contact.Contact_Details?.id === id
          );

          if (recordToDelete?.id) {
            await ZOHO.CRM.API.deleteRecord({
              Entity: "History_X_Contacts",
              RecordID: recordToDelete.id,
            });
          }
        }

        // Add new records for newly selected contacts
        for (const contact of toAddContacts) {
          try {
            await ZOHO.CRM.API.insertRecord({
              Entity: "History_X_Contacts",
              APIData: {
                Contact_History_Info: { id: historyId },
                Contact_Details: { id: contact.id },
              },
              Trigger: ["workflow"],
            });
          } catch (error) {
            console.error(
              `Error inserting record for contact ID ${contact.id}:`,
              error
            );
          }
        }

        // Notify parent about the updated record
        const updatedRecord = {
          id: selectedRowData.id || null, // Use the ID from the first related record
          ...finalData,
          Participants: selectedParticipants,
          historyDetails: {
            ...selectedRowData?.historyDetails,
            name: selectedParticipants.map((c) => c.Full_Name).join(", "),
          },
        };

        if (onRecordAdded) onRecordAdded(updatedRecord);

        setSnackbar({
          open: true,
          message: "Record and contacts updated successfully!",
          severity: "success",
        });
      } else {
        throw new Error("Failed to update record.");
      }
    } catch (error) {
      console.error("Error updating history:", error);
      throw error;
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
      setSnackbar({
        open: true,
        message: "Error deleting records.",
        severity: "error",
      });
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
    "Other",
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
              <FormControl
                fullWidth
                variant="standard"
                sx={{ fontSize: "9pt" }}
              >
                <InputLabel sx={{ fontSize: "9pt" }}>Type</InputLabel>
                <Select
                  value={formData.type || ""} // Ensure a fallback value
                  onChange={(e) => {
                    handleInputChange("type", e.target.value);
                    handleInputChange(
                      "result",
                      getResultOptions(e.target.value)
                    );
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
              <FormControl
                fullWidth
                variant="standard"
                sx={{ fontSize: "9pt" }}
              >
                <InputLabel sx={{ fontSize: "9pt" }}>Result</InputLabel>
                <Select
                  value={formData.result || ""} // Ensure a fallback value
                  onChange={(e) => {
                    const selectedResult = e.target.value;
                    handleInputChange("result", selectedResult);

                    // Autopopulate the type if a mapping exists
                    const correspondingType = typeMapping[selectedResult];
                    if (correspondingType) {
                      handleInputChange("type", correspondingType);
                    }
                  }}
                  label="Result"
                  sx={{
                    "& .MuiSelect-select": {
                      fontSize: "9pt",
                    },
                  }}
                >
                  {resultOptions.map((result) => (
                    <MenuItem
                      key={result}
                      value={result}
                      sx={{ fontSize: "9pt" }}
                    >
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
                width: "98%",
              }}
            >
              <Box sx={{ width: "99%", mt: -1 }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DemoContainer
                    components={["DateTimePicker"]}
                    sx={
                      {
                        // overflow: "hidden", // Prevent overflow in the DemoContainer
                      }
                    }
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
                        "& .MuiInputAdornment-root": {
                          marginLeft: "-8px", // Move the icon slightly to the left
                        },
                        "& .MuiSvgIcon-root": {
                          fontSize: "20px", // Adjust the icon size
                        },
                        overflow: "hidden", // Prevent overflow in the DateTimePicker
                      }}
                      slotProps={{
                        textField: {
                          variant: "standard",
                          margin: "dense",
                          InputProps: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton>
                                  <CalendarMonthIcon
                                    sx={{ fontSize: "20px" }}
                                  />
                                </IconButton>
                              </InputAdornment>
                            ),
                          },
                        },
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
                value={formData?.duration || null} // Provide a fallback value
                onChange={(event, newValue) =>
                  handleInputChange("duration", newValue)
                }
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
                componentsProps={{
                  popper: {
                    sx: {
                      "& .MuiAutocomplete-listbox": {
                        fontSize: "9pt", // Font size for dropdown options
                      },
                    },
                  },
                }}
                sx={{
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
                <VisuallyHiddenInput type="file" onChange={handleSelectFile} />
                {/* <input
                  type="file"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleInputChange("attachment", file);
                    }
                  }}
                /> */}
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
              value={formData?.details || ""} // Use controlled input
              onChange={(e) => handleInputChange("details", e.target.value)}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "9pt", // Input text font size
                },
                "& .MuiInputLabel-root": {
                  fontSize: "9pt", // Label font size
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions
          sx={{ display: "flex", justifyContent: "space-between" }}
        >
          {selectedRowData !== undefined ? (
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
          ) : (
            <div></div>
          )}
          <Box sx={{ display: "flex", gap: 1 }}>
            {" "}
            <Button
              onClick={handleCloseDialog}
              variant="outlined"
              sx={{ fontSize: "9pt" }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="contained" sx={{ fontSize: "9pt" }}>
              {buttonText}
            </Button>
          </Box>
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
