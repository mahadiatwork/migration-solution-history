import { useEffect, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";

export default function Stakeholder({ formData, handleInputChange, ZOHO }) {
  const [stakeholders, setStakeholders] = useState([]);
  const [selectedStakeholder, setSelectedStakeholder] = useState(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    // Reset state when formData changes
    if (formData?.stakeHolder) {
      setSelectedStakeholder(formData.stakeHolder);
      setInputValue(formData.stakeHolder.name || "");
    } else {
      setSelectedStakeholder(null);
      setInputValue("");
    }
  }, [formData]);

  const fetchStakeholders = async (query) => {
    if (!ZOHO || !query.trim()) return;

    try {
      const results = await ZOHO.CRM.API.searchRecord({
        Entity: "Accounts",
        Type: "word",
        Query: query.trim(),
      });
      if (results.data) {
        const formattedResults = results.data.map((record) => ({
          id: record.id,
          name: record.Account_Name,
        }));
        setStakeholders(formattedResults);
      }
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
    }
  };

  const handleInputChangeWithDebounce = (event, newValue) => {
    setInputValue(newValue);

    if (newValue) {
      const debounceTimeout = setTimeout(
        () => fetchStakeholders(newValue),
        500
      );
      return () => clearTimeout(debounceTimeout);
    }
  };

  const handleChange = (event, newValue) => {
    setSelectedStakeholder(newValue);
    handleInputChange("stakeHolder", newValue);
  };

  return (
    <Autocomplete
      options={stakeholders}
      getOptionLabel={(option) => option.name || ""}
      value={selectedStakeholder}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={handleInputChangeWithDebounce}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Stakeholder"
          variant="standard"
          sx={{ 
            "& .MuiInputLabel-root": { fontSize: "9pt" },  // Label size
            "& .MuiInputBase-input": { fontSize: "9pt" }   // Input text size
          }}
        />
      )}
    />
  );
}
