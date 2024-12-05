import React, { useState, useEffect } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
} from "@mui/material";

const RegardingField = ({ formData, handleInputChange }) => {
  const predefinedOptions = [
    "Hourly Consult $220",
    "Initial Consultation Fee $165",
    "No appointments today",
    "No appointments tonight",
  ]; // The predefined options

  const [selectedValue, setSelectedValue] = useState(formData.regarding || "");
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    // Check if the selected value is part of the predefined options
    if (selectedValue && !predefinedOptions.includes(selectedValue)) {
      setSelectedValue("Other"); // Set to "Other" if it doesn't match any predefined option
      setManualInput(formData.regarding); // Populate manual input with the custom value
    }
  }, [selectedValue, formData.regarding]);

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);
    if (value !== "Other") {
      setManualInput(""); // Clear manual input if predefined option is selected
      handleInputChange("regarding", value); // Pass the selected value to handleInputChange
    }
  };

  const handleManualInputChange = (event) => {
    const value = event.target.value;
    setManualInput(value);
    handleInputChange("regarding", value); // Pass the manual input value to handleInputChange
  };

  return (
    <Box sx={{ width: "100%", mt: "3px" }}>
      <FormControl fullWidth size="small" variant="standard">
        <InputLabel
          id="regarding-label"
          sx={{
            fontSize: "9pt", // Adjust label font size
          }}
        >
          Regarding
        </InputLabel>
        <Select
          labelId="regarding-label"
          id="regarding-select"
          value={selectedValue}
          onChange={handleSelectChange}
          sx={{
            "& .MuiInputBase-root": {
              padding: "0 !important",
            },
            fontSize: "9pt", // Ensure the dropdown options also have a 9pt font size
          }}
        >
          {predefinedOptions.map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          <MenuItem value="Other" sx={{ fontSize: "9pt" }}>
            Other (Manually enter)
          </MenuItem>
        </Select>
      </FormControl>

      {selectedValue === "Other" && (
        <TextField
          label="Enter your custom regarding"
          fullWidth
          variant="standard"
          size="small"
          value={manualInput}
          onChange={handleManualInputChange}
          sx={{
            mt: 2,
            "& .MuiInputBase-root": {
              padding: "0 !important",
            },
            "& .MuiInputLabel-root": {
              fontSize: "9pt", // Ensure the custom input's label is also 9pt
            },
          }}
        />
      )}
    </Box>
  );
};

export default RegardingField;
