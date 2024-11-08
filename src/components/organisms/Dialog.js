import * as React from "react";
import dayjs from "dayjs";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import { Dialog as MUIDialog } from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
//---------------
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
//---------------

export function Dialog({ openDialog, handleCloseDialog, obj, title }) {
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
          const date = formJson.date;
          const time = formJson.time;
          const dateString = date + ":" + time;
          const date_time = dayjs(
            dateString,
            "DD:MM:YYYY:hh:mm A"
          ).toISOString();
          const type = formJson.type;
          const result = formJson.result;
          const duration = formJson.duration;
          const record_Manager = formJson.record_Manager;
          const regarding = formJson.regarding;
          const details = formJson.details;

          console.log({
            date,
            time,
            date_time,
            type,
            result,
            duration,
            record_Manager,
            regarding,
            details,
          });
          handleCloseDialog();
        },
        sx: { minWidth: "40%" },
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex" }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DemoContainer components={["DatePicker"]} sx={{ flexGrow: 1 }}>
              <DatePicker
                sx={{
                  overflow: "hidden",
                  flexGrow: 1,
                  "& button": { mr: 0 },
                }}
                id="date"
                label="Date"
                name="date"
                value={dayjs(obj?.date_time)}
                format="DD:MM:YYYY"
                fullWidth
                slotProps={{
                  textField: { variant: "standard", margin: "dense" },
                }}
              />
            </DemoContainer>
          </LocalizationProvider>
        </Box>

        <Box sx={{ display: "flex" }}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DemoContainer components={["TimePicker"]} sx={{ flexGrow: 1 }}>
              <TimePicker
                sx={{
                  overflow: "hidden",
                  flexGrow: 1,
                  "& button": { mr: 0 },
                }}
                id="time"
                label="Time"
                name="time"
                value={dayjs(obj?.date_time)}
                fullWidth
                slotProps={{
                  textField: { variant: "standard", margin: "dense" },
                }}
              />
            </DemoContainer>
          </LocalizationProvider>
        </Box>

        <TextField
          margin="dense"
          id="type"
          name="type"
          label="Type"
          fullWidth
          variant="standard"
          value={obj?.type}
        />
        <TextField
          margin="dense"
          id="result"
          name="result"
          label="Result"
          fullWidth
          variant="standard"
          value={obj?.result}
        />
        <TextField
          margin="dense"
          id="duration"
          name="duration"
          label="Duration"
          fullWidth
          variant="standard"
          value={obj?.duration}
        />
        <TextField
          margin="dense"
          id="record_Manager"
          name="record_Manager"
          label="Record Manager"
          fullWidth
          variant="standard"
          value={obj?.record_Manager?.name}
        />
        <TextField
          margin="dense"
          id="regarding"
          name="regarding"
          label="Regarding"
          fullWidth
          variant="standard"
          value={obj?.regarding}
        />
        <TextField
          margin="dense"
          id="details"
          name="details"
          label="Details"
          multiline
          fullWidth
          variant="standard"
          value={obj?.details}
        />
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
