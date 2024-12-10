import * as React from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import DownloadIcon from "@mui/icons-material/Download";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { useZohoInit } from "./hook/useZohoInit";
import { zohoApi } from "./zohoApi";
import { Table } from "./components/organisms/Table";
import { Dialog } from "./components/organisms/Dialog";
import { TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";

dayjs.extend(utc);
dayjs.extend(timezone);

const ZOHO = window.ZOHO;

const parentContainerStyle = {
    borderTop: "1px solid #BABABA",
    minHeight: "calc(100vh - 1px)",
    p: "1em",
};

function isInLastNDays(date, pre) {
    const now = dayjs();
    const daysAgo = now.subtract(pre, "day");
    return dayjs(date).isAfter(daysAgo);
}

const dateOptions = [
    { label: "All" },
    { label: "Last 7 days", preDay: 7 },
    { label: "Last 30 days", preDay: 30 },
];

const App = () => {
    const { module, recordId } = useZohoInit();
    const [initPageContent, setInitPageContent] = React.useState(<CircularProgress />);
    const [relatedListData, setRelatedListData] = React.useState([]);
    const [selectedRecordId, setSelectedRecordId] = React.useState(null);
    const [openEditDialog, setOpenEditDialog] = React.useState(false);
    const [openCreateDialog, setOpenCreateDialog] = React.useState(false);
    const [ownerList, setOwnerList] = React.useState([]);
    const [selectedOwner, setSelectedOwner] = React.useState(null);
    const [typeList, setTypeList] = React.useState([]);
    const [selectedType, setSelectedType] = React.useState(null);
    const [dateRange, setDateRange] = React.useState(null);
    const [keyword, setKeyword] = React.useState("");
    const [loggedInUser, setLoggedInUser] = React.useState(null);
    const [selectedRowData, setSelectedRowData] = React.useState(null);
    const [currentContact, setCurrentContact] = React.useState(null);
    const [zohoLoaded, setZohoLoaded] = React.useState(false);
    const [regarding, setRegarding] = React.useState("");
    const [details, setDetails] = React.useState("");

    const handleClickOpenCreateDialog = () => {
        setOpenCreateDialog(true);
    };

    const handleCloseCreateDialog = () => {
        setOpenCreateDialog(false);
    };

    const handleClickOpenEditDialog = (rowData) => {
        setOpenEditDialog(true);
        setSelectedRowData(rowData);
    };

    const handleCloseEditDialog = (updatedRowData) => {
        if (updatedRowData) {
            setRelatedListData((prevData) =>
                prevData.map((item) =>
                    item.id === updatedRowData.id
                        ? {
                            ...item,
                            ...updatedRowData,
                            name: updatedRowData.Participants
                                ? updatedRowData.Participants.map((c) => c.Full_Name).join(", ")
                                : item.name,
                        }
                        : item
                )
            );
            setHighlightedRecordId(updatedRowData.id); // Set the highlighted record ID
        }
        setOpenEditDialog(false);
    };





    React.useEffect(() => {
        const fetchRLData = async () => {
            try {
                const { data } = await zohoApi.record.getRecordsFromRelatedList({
                    module,
                    recordId,
                    RelatedListAPI: "History3",
                });

                const usersResponse = await ZOHO.CRM.API.getAllUsers({ Type: "AllUsers" });
                const validUsers = usersResponse?.users?.filter((user) => user?.full_name && user?.id);
                setOwnerList(validUsers || []);

                const currentUserResponse = await ZOHO.CRM.CONFIG.getCurrentUser();
                setLoggedInUser(currentUserResponse?.users?.[0] || null);

                const currentContactResponse = await ZOHO.CRM.API.getRecord({
                    Entity: module,
                    approved: "both",
                    RecordID: recordId,
                });
                setCurrentContact(currentContactResponse?.data?.[0] || null);

                const tempData = data?.map((obj) => ({
                    name: obj?.Name || "No Name",
                    id: obj?.id,
                    date_time: obj?.History_Date_Time,
                    type: obj?.History_Type || "Unknown Type",
                    result: obj?.History_Result || "No Result",
                    duration: obj?.duration_min || "N/A",
                    regarding: obj?.Regarding || "No Regarding",
                    details: obj?.History_Details || "No Details",
                    icon: <DownloadIcon />,
                    ownerName: obj?.Owner?.name || "Unknown Owner",
                    historyDetails: obj?.Contact_History_Info,
                    stakeHolder: obj?.Stakeholder,
                }));

                setRelatedListData(tempData || []);

                const types = data
                    ?.map((el) => el.History_Type)
                    ?.filter((el) => el !== undefined && el !== null);
                setTypeList([...new Set(types)]);

                setInitPageContent(null);
            } catch (error) {
                console.error("Error fetching data:", error);
                setInitPageContent("Error loading data.");
            }
        };

        if (module && recordId) {
            fetchRLData();
        }
    }, [module, recordId]);

    const [highlightedRecordId, setHighlightedRecordId] = React.useState(null);

const handleRecordAdded = (newRecord) => {
  setRelatedListData((prevData) => {
    const newData = [
      {
        ...newRecord,
        name: newRecord.Participants
          ? newRecord.Participants.map((c) => c.Full_Name).join(", ")
          : newRecord.name,
      },
      ...prevData,
    ];
    console.log("Updated Related List Data:", newData); // Debug
    return newData;
  });
  setHighlightedRecordId(newRecord.id); // Highlight the new record
};



    const handleRightSideDataShow = (currentRegarding, currentDetails) => {
        setRegarding(currentRegarding || "No Regarding");
        setDetails(currentDetails || "No Details");
    };

    const handleRecordUpdate = (updatedRecord) => {
        console.log("Updated Record:", updatedRecord);

        // Normalize updatedRecord keys to match relatedListData keys
        const normalizedRecord = {
            ...updatedRecord,
            type: updatedRecord.History_Type,
            result: updatedRecord.History_Result,
            duration: updatedRecord.Duration,
            regarding: updatedRecord.Regarding,
            details: updatedRecord.History_Details_Plain,
            // name: updatedRecord.Participants
            //     ? updatedRecord.Participants.map((c) => c.Full_Name).join(", ")
            //     : updatedRecord.name,
        };

        setRelatedListData((prevData) => {
            const updatedData = prevData.map((row) => {
                if (row.id === updatedRecord.id) {
                    return {
                        ...row,
                        ...normalizedRecord,
                    };
                }
                return row;
            });

            console.log("Updated Related List Data:", updatedData);
            return updatedData;
        });

        setHighlightedRecordId(updatedRecord.id); // Highlight the updated record
    };




    return (
        <React.Fragment>
            <Box sx={parentContainerStyle}>
                {initPageContent ? (
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
                ) : relatedListData?.length > 0 ? (
                    <Grid container spacing={2}>
                        <Grid
                            item
                            xs={9}
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "1rem",
                                "& > *": { flexGrow: 1, flexBasis: "0px" },
                            }}
                        >
                            <Autocomplete
                                size="small"
                                options={dateOptions}
                                sx={{
                                    "& .MuiInputBase-root": {
                                        height: "33px",
                                    },
                                    "& .MuiInputLabel-root": {
                                        fontSize: "9pt", // Adjust label font size
                                    }
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Dates"
                                        size="small"
                                        InputLabelProps={{ style: { fontSize: "9pt" } }} // Additional inline styling for the label
                                    />
                                )}
                                onChange={(e, value) => setDateRange(value)}
                            />

                            <Autocomplete
                                size="small"
                                options={typeList}
                                sx={{
                                    width: "8rem",
                                    "& .MuiInputBase-root": {
                                        height: "33px",
                                    },
                                    "& .MuiInputLabel-root": {
                                        fontSize: "9pt", // Adjust label font size
                                    }
                                }}
                                renderInput={(params) => <TextField {...params} label="Types" size="small" />}
                                onChange={(e, value) => setSelectedType(value)}
                            />
                            <TextField
                                size="small"
                                label="Keyword"
                                variant="outlined"
                                sx={{
                                    width: "8rem",
                                    "& .MuiInputBase-root": {
                                        height: "33px",
                                    },
                                    "& .MuiInputLabel-root": {
                                        fontSize: "9pt", // Adjust label font size
                                    }

                                }}
                                onChange={(e) => setKeyword(e.target.value)}
                            />
                            <Autocomplete
                                size="small"
                                options={ownerList || []}
                                getOptionLabel={(option) => option?.full_name || "Unknown User"}
                                value={selectedOwner || null}
                                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                sx={{
                                    width: "8rem",
                                    "& .MuiInputBase-root": {
                                        height: "33px",
                                    },
                                    "& .MuiInputLabel-root": {
                                        fontSize: "9pt", // Adjust label font size
                                    }

                                }}
                                renderInput={(params) => <TextField {...params} label="Users" size="small" />}
                                onChange={(e, value) => setSelectedOwner(value)}
                            />
                        </Grid>
                        <Grid item xs={3} sx={{ display: "flex", justifyContent: "flex-end" }}>
                            <Button
                                variant="contained"
                                sx={{
                                    flexGrow: 1,
                                    padding: "4px 8px",
                                    fontSize: "0.75rem",
                                    minHeight: "33px",
                                    maxHeight: "33px",
                                    lineHeight: "1rem",
                                }}
                                onClick={handleClickOpenCreateDialog}
                            >
                                Create
                            </Button>
                        </Grid>
                        <Grid item xs={9}>

                            <Table
                                rows={relatedListData
                                    ?.filter((el) => (selectedOwner ? el.ownerName === selectedOwner?.full_name : true))
                                    ?.filter((el) => (selectedType ? el?.type === selectedType : true))
                                    ?.filter((el) => (dateRange?.preDay ? isInLastNDays(el?.date_time, dateRange?.preDay) : true))}
                                setSelectedRecordId={setSelectedRecordId}
                                handleClickOpenEditDialog={handleClickOpenEditDialog}
                                handleRightSideDataShow={handleRightSideDataShow}
                                highlightedRecordId={highlightedRecordId} // Pass highlighted ID to the table
                            />

                        </Grid>
                        <Grid item xs={3}>
                            <Paper sx={{ height: "100%", position: "relative" }}>
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: "1rem",
                                        overflow: "auto",
                                        wordWrap: "break-word",
                                        whiteSpace: "normal",
                                    }}
                                >
                                    {!!regarding && (
                                        <span
                                            style={{
                                                display: "block",
                                                marginBottom: "4px",
                                                padding: "4px",
                                                backgroundColor: "rgba(236, 240, 241, 1)",
                                                borderRadius: "4px",
                                                wordWrap: "break-word",
                                                whiteSpace: "normal",
                                                fontSize: "9pt",
                                            }}
                                        >
                                            {regarding}
                                        </span>
                                    )}
                                    <span style={{ wordWrap: "break-word", whiteSpace: "normal", fontSize: "9pt" }}>
                                        {details || "No data"}
                                    </span>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                ) :
                    <Box>
                        <Grid container spacing={2}>
                            <Grid
                                item
                                xs={9}
                                sx={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: "1rem",
                                    "& > *": { flexGrow: 1, flexBasis: "0px" },
                                }}
                            >
                                <Autocomplete
                                    size="small"
                                    options={dateOptions}
                                    sx={{
                                        width: "8rem",
                                        "& .MuiInputBase-root": {
                                            height: "30px",
                                        },
                                    }}
                                    renderInput={(params) => <TextField {...params} label="Dates" size="small" />}
                                    onChange={(e, value) => setDateRange(value)}
                                />
                                <Autocomplete
                                    size="small"
                                    options={typeList}
                                    sx={{
                                        width: "8rem",
                                        "& .MuiInputBase-root": {
                                            height: "30px",
                                        },
                                    }}
                                    renderInput={(params) => <TextField {...params} label="Types" size="small" />}
                                    onChange={(e, value) => setSelectedType(value)}
                                />
                                <TextField
                                    size="small"
                                    label="Keyword"
                                    variant="outlined"
                                    sx={{
                                        width: "8rem",
                                        "& .MuiInputBase-root": {
                                            height: "30px",
                                        },
                                    }}
                                    onChange={(e) => setKeyword(e.target.value)}
                                />
                                <Autocomplete
                                    size="small"
                                    options={ownerList || []}
                                    getOptionLabel={(option) => option?.full_name || "Unknown User"}
                                    value={selectedOwner || null}
                                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                                    sx={{
                                        width: "8rem",
                                        "& .MuiInputBase-root": {
                                            height: "30px",
                                        },
                                    }}
                                    renderInput={(params) => <TextField {...params} label="Users" size="small" />}
                                    onChange={(e, value) => setSelectedOwner(value)}
                                />
                            </Grid>
                            <Grid item xs={3} sx={{ display: "flex", justifyContent: "flex-end" }}>
                                <Button
                                    variant="contained"
                                    sx={{
                                        flexGrow: 1,
                                        padding: "4px 8px",
                                        fontSize: "0.75rem",
                                        minHeight: "30px",
                                        maxHeight: "30px",
                                        lineHeight: "1rem",
                                    }}
                                    onClick={handleClickOpenCreateDialog}
                                >
                                    Create
                                </Button>
                            </Grid>
                        </Grid>
                        <Box mt={2}>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Name</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Result</TableCell>
                                            <TableCell>Date & Time</TableCell>
                                            <TableCell>Owner</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {relatedListData.length > 0 ? (
                                            relatedListData.map((row) => (
                                                <TableRow
                                                    key={row.id}
                                                    sx={{
                                                        backgroundColor: row.id === highlightedRecordId ? "rgba(0, 123, 255, 0.1)" : "inherit", // Highlight if ID matches
                                                    }}
                                                >
                                                    <TableCell>{row.name || "Unknown Name"}</TableCell>
                                                    <TableCell>{row.type || "Unknown Type"}</TableCell>
                                                    <TableCell>{row.result || "No Result"}</TableCell>
                                                    <TableCell>
                                                        {row.date_time ? dayjs(row.date_time).format("DD/MM/YYYY HH:mm A") : "No Date"}
                                                    </TableCell>
                                                    <TableCell>{row.ownerName || "Unknown Owner"}</TableCell>
                                                </TableRow>

                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center">
                                                    No data available
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Box>
                }
            </Box>
            <Dialog
                openDialog={openEditDialog}
                handleCloseDialog={handleCloseEditDialog}
                title="Edit History"
                ownerList={ownerList}
                loggedInUser={loggedInUser}
                ZOHO={ZOHO}
                selectedRowData={selectedRowData}
                onRecordAdded={handleRecordUpdate} // Update the existing record
            />
            <Dialog
                openDialog={openCreateDialog}
                handleCloseDialog={handleCloseCreateDialog}
                title="Create"
                ownerList={ownerList}
                loggedInUser={loggedInUser}
                ZOHO={ZOHO}
                onRecordAdded={handleRecordAdded} // Pass the callback
                currentContact={currentContact}
            />

        </React.Fragment>
    );
};

export default App;
