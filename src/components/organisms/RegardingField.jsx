import React, { useState, useEffect, useRef } from "react";
import { FormControl, InputLabel, Select, MenuItem, TextField, Box } from "@mui/material";
import { getRegardingOptions } from "./helperFunc";

const RegardingField = ({ formData, handleInputChange, selectedRowData, picklistConfig }) => {
  const existingValue = formData?.regarding ?? selectedRowData?.regarding ?? "";
  const moduleIsAuthoritative = picklistConfig?._source === "custom_module";
  const configuredOptions = React.useMemo(
    () => getRegardingOptions(formData?.type, "", picklistConfig) || [],
    [formData?.type, picklistConfig]
  );
  const predefinedOptions = React.useMemo(
    () =>
      getRegardingOptions(formData?.type, existingValue, picklistConfig) || [],
    [existingValue, formData?.type, picklistConfig]
  );
  const allowManualOther =
    !moduleIsAuthoritative || configuredOptions.includes("Other");

  const [selectedValue, setSelectedValue] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false); // New state to control visibility
  const previousType = useRef(formData?.type);

  useEffect(() => {
    const typeChanged = previousType.current !== formData?.type;
    previousType.current = formData?.type;

    // Keep the manual editor stable while its text is mirrored into formData.
    if (!typeChanged && allowManualOther && showManualInput) return;

    if (existingValue) {
      if (predefinedOptions.includes(existingValue)) {
        setSelectedValue(existingValue);
        setManualInput("");
        setShowManualInput(
          allowManualOther && existingValue === "Other"
        );
      } else if (allowManualOther) {
        setSelectedValue("Other");
        setManualInput(existingValue);
        setShowManualInput(true);
      } else {
        setSelectedValue("");
        setManualInput("");
        setShowManualInput(false);
      }
    } else {
      setSelectedValue("");
      setManualInput("");
      setShowManualInput(false);
    }
  }, [allowManualOther, existingValue, formData?.type, predefinedOptions, showManualInput]);
  

  const handleSelectChange = (event) => {
    const value = event.target.value;
    setSelectedValue(value);
  
    if (value === "Other" && allowManualOther) {
      setShowManualInput(true); 
      setManualInput(""); 
      handleInputChange("regarding", "Other"); // ✅ Set "Other" in formData
    } else {
      console.log({value})
      setShowManualInput(false); 
      setManualInput("");
      handleInputChange("regarding", value);
    }
  };
  

  const handleManualInputChange = (event) => {
    const value = event.target.value;
    setManualInput(value);
    handleInputChange("regarding", value);
  };

  return (
    <Box sx={{ width: "100%", mt: "3px" }}>
      <FormControl fullWidth size="small" variant="standard">
        <InputLabel id="regarding-label" sx={{ fontSize: "9pt" }}>
          Regarding
        </InputLabel>
        <Select
          labelId="regarding-label"
          id="regarding-select"
          value={selectedValue}
          onChange={handleSelectChange}
          sx={{ "& .MuiInputBase-root": { padding: "0 !important" }, fontSize: "9pt" }}
        >
          {(Array.isArray(predefinedOptions) ? predefinedOptions : []).map((option) => (
            <MenuItem key={option} value={option} sx={{ fontSize: "9pt" }}>
              {option}
            </MenuItem>
          ))}
          {allowManualOther && !predefinedOptions.includes("Other") && (
            <MenuItem value="Other" sx={{ fontSize: "9pt" }}>
              Other (Manually enter)
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {allowManualOther && showManualInput ?
        <TextField
          label="Enter your custom regarding"
          fullWidth
          variant="standard"
          size="small"
          value={manualInput}
          onChange={handleManualInputChange}
          sx={{
            mt: 2,
            "& .MuiInputBase-input": { fontSize: "9pt" },
            "& .MuiInputLabel-root": { fontSize: "9pt" },
            "& .MuiFormHelperText-root": { fontSize: "9pt" },
          }}
        /> : <></>
      }
    </Box>
  );
};

export default RegardingField;
