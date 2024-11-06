import * as React from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import { Dialog as MUIDialog } from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { getDate } from "../../util/util";

export function Dialog({ openDialog, handleCloseDialog, obj, title }) {
  const tempObj = {
    id: obj?.id,
    date: getDate(obj?.History_Date_Time)?.[0],
    time: getDate(obj?.History_Date_Time)?.[1],
    type: obj?.History_Type,
    result: obj?.History_Result,
    duration: obj?.duration_min,
    record_Manager: obj?.Owner,
    regarding: obj?.Regarding,
    details: obj?.History_Details,
  };

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
          const type = formJson.type;
          const result = formJson.result;
          const duration = formJson.duration;
          const record_Manager = formJson.record_Manager;
          const regarding = formJson.regarding;
          const details = formJson.details;

          console.log({
            date,
            time,
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
        <TextField
          margin="dense"
          id="date"
          name="date"
          label="Date"
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.date : null}
        />
        <TextField
          margin="dense"
          id="time"
          name="time"
          label="time"
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.time : null}
        />
        <TextField
          margin="dense"
          id="type"
          name="type"
          label="Type"
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.type : null}
        />
        <TextField
          margin="dense"
          id="result"
          name="result"
          label="Result"
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.result : null}
        />
        <TextField
          margin="dense"
          id="duration"
          name="duration"
          label="Duration"
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.duration : null}
        />
        <TextField
          margin="dense"
          id="record_Manager"
          name="record_Manager"
          label="Record Manager"
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.record_Manager?.name : null}
        />
        <TextField
          margin="dense"
          id="regarding"
          name="regarding"
          label="Regarding"
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.regarding : null}
        />
        <TextField
          margin="dense"
          id="details"
          name="details"
          label="Details"
          multiline
          fullWidth
          variant="standard"
          value={!!obj ? tempObj?.details : null}
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
