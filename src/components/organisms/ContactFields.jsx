import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
} from "@mui/material";

export default function ContactField({
  handleInputChange,
  ZOHO,
  selectedRowData = {}, // Default to an empty object
  currentContact,
  selectedContacts = [], // Provided selected contacts
}) {
  const [contacts, setContacts] = useState([]); // Fetched contacts
  const [selectedParticipants, setSelectedParticipants] = useState([]); // Selected participants
  const [searchType, setSearchType] = useState("First_Name"); // Search criteria
  const [searchText, setSearchText] = useState(""); // Search input
  const [filteredContacts, setFilteredContacts] = useState([]); // Filtered contacts for display
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal state
  const didMount = useRef(false); // Track initial render

  // Fetch history data when `selectedRowData` changes
  useEffect(() => {

    console.log("checking data", selectedRowData?.historyDetails)
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

          // Map the data to the required format
          const contactDetailsArray = data.data.map((record) => ({
            Full_Name: record.Contact_Details?.name || "Unknown Name",
            id: record.Contact_Details?.id || "Unknown ID",
          }));

          setContacts(contactDetailsArray);
          setSelectedParticipants(contactDetailsArray);
          handleInputChange("Participants", contactDetailsArray); // Sync with parent
        } catch (error) {
          console.error("Error fetching related contacts:", error);
        }
      }else{
        setContacts([currentContact]);
        setSelectedParticipants([currentContact]);
        handleInputChange("Participants", [currentContact]); // Sync with parent
        console.log("currentContectIn", currentContact)
      }
    };

    fetchHistoryData();
  }, [selectedRowData, ZOHO, handleInputChange]);

  // Open modal and reset filtered contacts
  const handleOpen = () => {
    setFilteredContacts([]);
    setIsModalOpen(true);
  };

  // Close modal
  const handleCancel = () => {
    setIsModalOpen(false);
  };

  // Fetch and filter contacts
  const handleSearch = async () => {
    if (!ZOHO || !searchText.trim()) return;

    try {
      let searchResults;

      if (searchType === "Email") {
        searchResults = await ZOHO.CRM.API.searchRecord({
          Entity: "Contacts",
          Type: "email",
          Query: searchText.trim(),
        });
      } else {
        searchResults = await ZOHO.CRM.API.searchRecord({
          Entity: "Contacts",
          Type: "criteria",
          Query: `(${searchType}:equals:${searchText.trim()})`,
        });
      }

      if (searchResults.data && searchResults.data.length > 0) {
        const formattedContacts = searchResults.data.map((contact) => ({
          id: contact.id,
          Full_Name: `${contact.First_Name || "N/A"} ${
            contact.Last_Name || "N/A"
          }`,
          Email: contact.Email || "No Email",
          Mobile: contact.Mobile || "N/A",
          First_Name: contact.First_Name || "N/A",
          Last_Name: contact.Last_Name || "N/A",
          ID_Number: contact.ID_Number || "N/A",
        }));
        setFilteredContacts(formattedContacts);
      } else {
        setFilteredContacts([]);
      }
    } catch (error) {
      console.error("Error during search:", error);
      setFilteredContacts([]);
    }
  };

  // Toggle selection of a contact
  const toggleContactSelection = (contact) => {
    setSelectedParticipants((prev) => {
      const alreadySelected = prev.some((c) => c.id === contact.id);
      const updatedParticipants = alreadySelected
        ? prev.filter((c) => c.id !== contact.id) // Remove if already selected
        : [...prev, contact]; // Add if not selected

      // Prevent redundant updates
      if (
        JSON.stringify(updatedParticipants) !==
        JSON.stringify(selectedParticipants)
      ) {
        handleInputChange("Participants", updatedParticipants); // Sync with parent
      }

      return updatedParticipants;
    });
  };

  // Save selected participants to parent state
  const handleOk = () => {
    const formattedContacts = selectedParticipants.map((contact) => ({
      id: contact.id,
      Full_Name: contact.Full_Name,
      Email: contact.Email,
      Mobile: contact.Mobile,
    }));

    // Pass the updated contacts to the parent
    handleInputChange("Participants", formattedContacts); // Use "Participants" or the relevant field key

    setIsModalOpen(false);
  };

  const commonStyles = {
    "& .MuiInputBase-root": {
      fontSize: "9pt",
    },
    "& .MuiInputLabel-root": {
      fontSize: "9pt",
    },
    "& .MuiButton-root": {
      fontSize: "9pt",
    },
    "& .MuiTypography-root": {
      fontSize: "9pt",
    },
    "& .MuiTableCell-root": {
      fontSize: "9pt",
    },
    "& .MuiMenuItem-root": {
      fontSize: "9pt",
    },
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} sx={{ mt: 1 }}>
        <TextField
          fullWidth
          value={selectedParticipants
            .filter((c) => c && (c.Full_Name || c.First_Name || c.Last_Name)) // Filter out invalid entries
            .map((c) => c.Full_Name || `${c.First_Name || "N/A"} ${c.Last_Name || "N/A"}`)
            .join(", ")}
          
          variant="standard"
          placeholder="Selected contacts"
          InputProps={{
            readOnly: true,
          }}
          size="small"
          sx={commonStyles}
        />
        <Button
          variant="contained"
          onClick={handleOpen}
          size="small"
          sx={{ width: "100px", ...commonStyles }}
        >
          Contacts
        </Button>
      </Box>

      {/* Modal */}
      <Dialog open={isModalOpen} onClose={handleCancel} fullWidth maxWidth="md">
        <DialogContent sx={commonStyles}>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              select
              label="Search By"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              fullWidth
              size="small"
              sx={commonStyles}
            >
              <MenuItem value="First_Name" sx={{ fontSize: "9pt" }}>
                First Name
              </MenuItem>
              <MenuItem value="Last_Name" sx={{ fontSize: "9pt" }}>
                Last Name
              </MenuItem>
              <MenuItem value="Email" sx={{ fontSize: "9pt" }}>
                Email
              </MenuItem>
              <MenuItem value="Mobile" sx={{ fontSize: "9pt" }}>
                Mobile
              </MenuItem>
              <MenuItem value="ID_Number" sx={{ fontSize: "9pt" }}>
                MS File Number
              </MenuItem>
            </TextField>

            <TextField
              label="Search Text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
              size="small"
              sx={commonStyles}
            />
            <Button
              variant="contained"
              onClick={handleSearch}
              sx={{ width: "150px", ...commonStyles }}
            >
              Search
            </Button>
          </Box>

          {/* Results Table */}
          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>First Name</TableCell>
                  <TableCell>Last Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Mobile</TableCell>
                  <TableCell>MS File Number</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredContacts.length > 0 ? (
                  filteredContacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedParticipants.some(
                            (c) => c.id === contact.id
                          )}
                          onChange={() => toggleContactSelection(contact)}
                          sx={commonStyles}
                        />
                      </TableCell>
                      <TableCell>{contact.First_Name}</TableCell>
                      <TableCell>{contact.Last_Name}</TableCell>
                      <TableCell>{contact.Email}</TableCell>
                      <TableCell>{contact.Mobile}</TableCell>
                      <TableCell>{contact.ID_Number}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancel} variant="outlined" sx={commonStyles}>
            Cancel
          </Button>
          <Button
            onClick={handleOk}
            variant="contained"
            color="primary"
            disabled={selectedParticipants.length === 0}
            sx={commonStyles}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
