import * as React from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid2";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";

import { useZohoInit } from "./hook/useZohoInit";
import { zohoApi } from "./zohoApi";
import { Table } from "./components/organisms/Table";
import { Dialog } from "./components/organisms/Dialog";

const parentContainerStyle = {
  borderTop: "1px solid #BABABA",
  minHeight: "calc(100vh - 1px)",
  p: "1em",
};

const op = [
  { label: "The Shawshank Redemption", year: 1994 },
  { label: "The Godfather", year: 1972 },
];

function App() {
  const { module, recordId } = useZohoInit();
  const [initPageContent, setInitPageContent] = React.useState(
    <CircularProgress />
  );
  const [relatedListData, setRelatedListData] = React.useState();
  const [selectedRecordId, setSelectedRecordId] = React.useState();
  const [openEditDialog, setOpenEditDialog] = React.useState(false);
  const [openCreateDialog, setOpenCreateDialog] = React.useState(false);

  const handleClickOpenCreateDialog = () => {
    setOpenCreateDialog(true);
  };

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
  };

  const handleClickOpenEditDialog = () => {
    setOpenEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
  };

  React.useEffect(() => {
    const fetchRLData = async () => {
      const { data } = await zohoApi.record.getRecordsFromRelatedList({
        module,
        recordId,
        RelatedListAPI: "History3",
      });

      data?.length < 1
        ? setInitPageContent("No data")
        : setInitPageContent(undefined);

      setRelatedListData(data);
    };

    if (module && recordId) {
      fetchRLData();
    }
  }, [module, recordId]);

  let selectedObj = relatedListData?.filter(
    (obj) => obj?.id === selectedRecordId
  )?.[0];
  const regarding = selectedObj?.Regarding;
  const details = selectedObj?.History_Details;

  return (
    <React.Fragment>
      <Box sx={parentContainerStyle}>
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          {initPageContent}
        </span>
        {relatedListData?.length > 0 ? (
          <Grid container spacing={2}>
            <Grid
              size={8}
              sx={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <Autocomplete
                sx={{ flexGrow: 1 }}
                size="small"
                options={op}
                renderInput={(params) => (
                  <TextField {...params} label="Dates" />
                )}
              />
              <Autocomplete
                sx={{ flexGrow: 1 }}
                size="small"
                options={op}
                renderInput={(params) => (
                  <TextField {...params} label="Types" />
                )}
              />
              <Autocomplete
                sx={{ flexGrow: 1 }}
                size="small"
                options={op}
                renderInput={(params) => (
                  <TextField {...params} label="Keyword" />
                )}
              />
              <Autocomplete
                sx={{ flexGrow: 1 }}
                size="small"
                options={op}
                renderInput={(params) => (
                  <TextField {...params} label="Users" />
                )}
              />
            </Grid>
            <Grid size={4} sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                sx={{ minWidth: "14rem" }}
                onClick={handleClickOpenCreateDialog}
              >
                Create
              </Button>
            </Grid>
            <Grid size={8}>
              <Table
                rows={relatedListData}
                setSelectedRecordId={setSelectedRecordId}
                handleClickOpenEditDialog={handleClickOpenEditDialog}
              />
            </Grid>
            <Grid size={4}>
              <Paper
                sx={{
                  height: "100%",
                  position: "relative",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    inset: "1rem",
                    overflowY: "auto",
                  }}
                >
                  {regarding}
                  {details}
                  {!regarding && !details ? "No data" : null}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        ) : null}
      </Box>
      <Dialog
        openDialog={openEditDialog}
        handleCloseDialog={handleCloseEditDialog}
        obj={selectedObj}
        title="Edit History"
      />
      <Dialog
        openDialog={openCreateDialog}
        handleCloseDialog={handleCloseCreateDialog}
        title="Create"
      />
    </React.Fragment>
  );
}

export default App;
