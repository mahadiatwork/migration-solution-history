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
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  Grid,
  InputAdornment,
  Modal,
  Paper,
  Typography,
  CircularProgress,
} from "@mui/material";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { getRegardingOptions, getResultOptions } from "./helperFunc";
import {
  getTypeOptionsFromConfig,
  getDurationOptionsFromConfig,
} from "../../services/picklistConfigService";
import ContactField from "./ContactFields";
import RegardingField from "./RegardingField";
import IconButton from "@mui/material/IconButton"; // For the clickable icon button
import { styled } from "@mui/material/styles";
import { zohoApi } from "../../zohoApi";
import ApplicationDialog from "./ApplicationTable";
import Stakeholder from "../atoms/Stakeholder";
import { Close } from "@mui/icons-material";
import {
  buildMatterSnapshotFields,
  fetchContactMatters,
  fetchMatterById,
  findRelatedMatter,
  normalizeSingleMultiSelectValue,
  selectPrimaryMatter,
  serializeMultiSelectPicklist,
} from "../../services/matterSnapshot";
import {
  fetchMatterPicklistMetadata,
  getProgressOptions,
  getStageOptions,
  normalizePicklistValue,
} from "../../services/matterMetadata";
import {
  billingTypeOptions,
  buildJunctionSyncFields,
  buildViewOwner,
  DEFAULT_ACTIVITY_TYPE,
  DEFAULT_BILLING_TYPE,
  DEFAULT_CATEGORY,
  durationOptions as fallbackDurationOptions,
  mergeOrderedUnique,
  requireSuccessfulRecordResponse,
  serializeDuration,
  typeOptions as fallbackTypeOptions,
} from "./dialogConstants";
import { conn_name } from "../../config/config";

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

const EMPTY_MATTER_METADATA = {
  layoutId: null,
  stages: [],
  progress: [],
  progressByStage: {},
  dependencyError: null,
};

const normalizeLookup = (lookup) => {
  if (!lookup || typeof lookup !== "object") return null;
  const id = lookup.id ?? lookup.ID ?? lookup.Id;
  if (id == null) return null;
  return {
    id: String(id),
    name: lookup.name ?? lookup.Name ?? lookup.display_value ?? "",
  };
};

const getMatterOptionLabel = (matter) =>
  String(matter?.Name ?? matter?.name ?? matter?.Matter_No ?? "").trim();

const matterFormValuesFromHistory = (history) => ({
  matter: normalizeLookup(history?.Matter),
  matterNo: history?.Matter_No ?? "",
  currentStage: normalizePicklistValue(history?.Current_Stage),
  matterProgress: normalizeSingleMultiSelectValue(history?.Matter_Progress),
  billingType: history?.Billing_Type ?? DEFAULT_BILLING_TYPE,
});

export function Dialog({
  openDialog,
  handleCloseDialog,
  ownerList,
  loggedInUser,
  ZOHO, // Zoho instance for API calls
  selectedRowData,
  currentContact,
  onRecordAdded,
  selectedContacts,
  setSelectedContacts,
  buttonText = "Save",
  handleMoveToApplication,
  applications,
  openApplicationDialog,
  setOpenApplicationDialog,
  picklistConfig = null, // Admin-configurable picklist config from App.js
}) {
  // Derive picklist options from admin config (or fallback to hard-coded defaults)
  const durationOptions = picklistConfig
    ? getDurationOptionsFromConfig(picklistConfig)
    : fallbackDurationOptions;
  const typeOptions = picklistConfig
    ? getTypeOptionsFromConfig(picklistConfig)
    : fallbackTypeOptions;
  const [, setHistoryName] = React.useState("");
  const [historyContacts, setHistoryContacts] = React.useState([]);
  const [selectedOwner, setSelectedOwner] = React.useState(
    ownerList?.find(
      (owner) => owner?.full_name === selectedRowData?.ownerName
    ) ||
    loggedInUser ||
    null
  );
  const [, setSelectedType] = React.useState(DEFAULT_CATEGORY);
  const [loadedAttachmentFromRecord, setLoadedAttachmentFromRecord] =
    React.useState();
  const [formData, setFormData] = React.useState(selectedRowData || {}); // Form data state
  const visibleTypeOptions = mergeOrderedUnique(
    typeOptions,
    selectedRowData ? [selectedRowData.type, formData.type] : []
  );
  // console.log({ formData });
  const [snackbar, setSnackbar] = React.useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isMatterLoading, setIsMatterLoading] = React.useState(false);
  const [matterOptions, setMatterOptions] = React.useState([]);
  const [matterOptionsError, setMatterOptionsError] = React.useState("");
  const matterSelectionRequest = React.useRef(0);
  const [matterMetadata, setMatterMetadata] = React.useState(
    EMPTY_MATTER_METADATA
  );

  // Gate submit before the dialog is painted. The async effect below performs
  // the actual load and clears this flag, but a normal effect alone leaves a
  // same-frame Enter/Save window with incomplete matter snapshot data.
  React.useLayoutEffect(() => {
    setIsMatterLoading(Boolean(openDialog));
  }, [openDialog, selectedRowData, currentContact?.id]);

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
    const recordId = selectedRowData?.historyDetails?.id || selectedRowData?.history_id;
    if (!openDialog || !selectedRowData || !recordId) return;

    const getAttachment = async () => {
      const { data, error } = await zohoApi.file.getAttachments({
        module: "History1",
        recordId,
      });

      console.log("attachment data fetching", data, recordId);

      if (error) {
        console.warn("Attachment fetch error:", error);
        return;
      }
      if (data && data.length > 0) {
        setFormData((prev) => ({
          ...prev,
          attachment: { name: data[0]?.File_Name },
        }));
        setLoadedAttachmentFromRecord(data);
      }
    };
    getAttachment();
  }, [openDialog, selectedRowData]);

  // console.log({ selectedRowData })

  // Reinitialize dialog state when `openDialog` or `obj` changes
  React.useEffect(() => {
    if (openDialog) {
      setIsSubmitting(false);
      setFormData((prev) => {
        const crmConfigLoaded = picklistConfig?._source === "custom_module";
        const defaultType =
          typeOptions[0] || (crmConfigLoaded ? "" : DEFAULT_CATEGORY);
        const defaultResult =
          getResultOptions(defaultType, picklistConfig)[0] ||
          (crmConfigLoaded ? "" : DEFAULT_ACTIVITY_TYPE);
        const defaultDuration =
          durationOptions[0] ?? (crmConfigLoaded ? null : 0);
        const base = {
          Participants: selectedRowData?.Participants || [],
          result: selectedRowData?.result ?? defaultResult,
          type: selectedRowData?.type ?? defaultType,
          duration: selectedRowData?.duration ?? defaultDuration,
          regarding:
            selectedRowData?.regarding ??
            (getRegardingOptions(
              defaultType,
              "",
              picklistConfig
            )[0] || ""),
          details: selectedRowData?.details || "",
          matter: selectedRowData?.matter || null,
          matterNo: selectedRowData?.matterNo ?? "",
          currentStage: normalizePicklistValue(
            selectedRowData?.currentStage
          ),
          matterProgress: normalizeSingleMultiSelectValue(
            selectedRowData?.matterProgress
          ),
          billingType:
            selectedRowData?.billingType ?? DEFAULT_BILLING_TYPE,
          stakeHolder: (selectedRowData?.stakeHolder && typeof selectedRowData.stakeHolder === "object" && selectedRowData.stakeHolder?.id != null)
            ? selectedRowData.stakeHolder
            : null,
          date_time: selectedRowData?.date_time
            ? dayjs(selectedRowData.date_time)
            : dayjs(),
        };
        return {
          ...base,
          attachment: selectedRowData ? prev?.attachment : undefined,
        };
      });
      const participants = Array.isArray(selectedRowData?.Participants)
        ? selectedRowData.Participants.filter((p) => p && (p.id || p.Full_Name))
        : currentContact
          ? [currentContact]
          : [];
      setSelectedContacts(participants);
      const names = Array.isArray(selectedRowData?.Participants)
        ? selectedRowData.Participants.map((p) => p?.Full_Name || "").filter(Boolean).join(", ")
        : "";
      setHistoryName(names);
      // setSelectedOwner(loggedInUser || null);
      setSelectedOwner(
        ownerList?.find(
          (owner) => owner?.full_name === selectedRowData?.ownerName
        ) ||
        loggedInUser ||
        null
      );

      setHistoryContacts(
        Array.isArray(selectedRowData?.Participants)
          ? selectedRowData.Participants.filter((p) => p && (p.id || p.Full_Name))
          : []
      );
    } else {
      // Reset formData to avoid stale data
      setFormData({});
      setMatterOptions([]);
      setMatterOptionsError("");
      setMatterMetadata(EMPTY_MATTER_METADATA);
      setIsMatterLoading(false);
      matterSelectionRequest.current += 1;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ownerList, setSelectedContacts intentionally omitted
  }, [openDialog, selectedRowData, loggedInUser, currentContact]);

  React.useEffect(() => {
    if (!openDialog) return undefined;

    let cancelled = false;

    const loadMatterContext = async () => {
      matterSelectionRequest.current += 1;
      setIsMatterLoading(true);
      setMatterOptionsError("");
      setMatterMetadata(EMPTY_MATTER_METADATA);
      let sourceMatter = null;

      try {
        const primaryContactId =
          currentContact?.id ||
          (Array.isArray(selectedRowData?.Participants)
            ? selectedRowData.Participants.find((contact) => contact?.id)?.id
            : null) ||
          null;
        let relatedMatters = [];
        if (primaryContactId) {
          try {
            relatedMatters = await fetchContactMatters(primaryContactId);
          } catch (error) {
            console.warn("Could not load related Matters for selection:", error);
            if (!cancelled) {
              setMatterOptionsError(
                "Related Matters could not be loaded. Close and reopen the history to retry."
              );
            }
          }
        }
        if (!cancelled) setMatterOptions(relatedMatters);

        if (selectedRowData) {
          const rowValues = {
            matter: selectedRowData.matter || null,
            matterNo: selectedRowData.matterNo ?? "",
            currentStage: normalizePicklistValue(selectedRowData.currentStage),
            matterProgress: normalizeSingleMultiSelectValue(
              selectedRowData.matterProgress
            ),
            billingType:
              selectedRowData.billingType ?? DEFAULT_BILLING_TYPE,
          };
          let historyValues = rowValues;
          const historyId =
            selectedRowData?.historyDetails?.id || selectedRowData?.history_id;

          if (historyId) {
            try {
              const response = await ZOHO.CRM.API.getRecord({
                Entity: "History1",
                approved: "both",
                RecordID: historyId,
              });
              const history = response?.data?.[0];
              if (history) {
                const recordValues = matterFormValuesFromHistory(history);
                historyValues = {
                  matter: recordValues.matter || rowValues.matter,
                  matterNo: recordValues.matterNo || rowValues.matterNo,
                  currentStage:
                    recordValues.currentStage || rowValues.currentStage,
                  matterProgress:
                    recordValues.matterProgress || rowValues.matterProgress,
                  billingType:
                    history.Billing_Type ?? rowValues.billingType,
                };
              }
            } catch (error) {
              console.warn("Could not load History1 matter snapshot:", error);
            }
          }

          const matchedMatter = findRelatedMatter(relatedMatters, {
            matterId: historyValues.matter?.id,
            matterNo: historyValues.matterNo,
          });
          if (matchedMatter?.id) {
            try {
              sourceMatter =
                (await fetchMatterById(matchedMatter.id)) || matchedMatter;
            } catch (error) {
              console.warn("Could not load source Matter layout:", error);
              sourceMatter = matchedMatter;
            }
            historyValues = {
              ...historyValues,
              matter: normalizeLookup(sourceMatter),
            };
          }

          if (!cancelled) {
            setFormData((previous) => ({ ...previous, ...historyValues }));
          }
        } else {
          const primaryMatter = selectPrimaryMatter(relatedMatters);
          sourceMatter = primaryMatter;
          if (primaryMatter?.id) {
            try {
              sourceMatter =
                (await fetchMatterById(primaryMatter.id)) || primaryMatter;
            } catch (error) {
              console.warn("Could not hydrate primary Matter record:", error);
            }
          }
          const snapshotValues = matterFormValuesFromHistory({
            ...buildMatterSnapshotFields(sourceMatter),
            Matter: sourceMatter,
            Billing_Type: DEFAULT_BILLING_TYPE,
          });

          if (!cancelled) {
            setFormData((previous) => ({
              ...previous,
              ...snapshotValues,
              billingType: DEFAULT_BILLING_TYPE,
            }));
          }
        }

        const metadata = await fetchMatterPicklistMetadata(sourceMatter);
        if (!cancelled) setMatterMetadata(metadata);
      } catch (error) {
        console.warn("Could not initialise matter history fields:", error);
      } finally {
        if (!cancelled) setIsMatterLoading(false);
      }
    };

    loadMatterContext();
    return () => {
      cancelled = true;
      matterSelectionRequest.current += 1;
    };
  }, [openDialog, selectedRowData, currentContact?.id, ZOHO]);

  React.useEffect(() => {
    const fetchHistoryData = async () => {
      if (selectedRowData?.history_id) {
        try {
          const data = await ZOHO.CRM.API.getRelatedRecords({
            Entity: "History1",
            RecordID: selectedRowData?.history_id,
            RelatedList: "Contacts3",
            page: 1,
            per_page: 200,
          });

          const dataArray = Array.isArray(data?.data) ? data.data : [];
          const contactDetailsArray = dataArray
            .map((record) => {
              const contact = record?.Contact_Details;
              if (!contact || !contact.id) return null;
              return {
                Full_Name: contact.name || contact.Full_Name || "",
                id: contact.id,
              };
            })
            .filter(Boolean);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ZOHO.CRM.API, setSelectedContacts intentionally omitted
  }, [selectedRowData?.history_id, openDialog]);

  React.useEffect(() => {
    const contacts = Array.isArray(selectedContacts) ? selectedContacts : [];
    const names = contacts
      .map((contact) => contact?.Full_Name || contact?.full_name || "")
      .filter(Boolean)
      .join(", ");
    setHistoryName(names);
  }, [selectedContacts]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const matchedMatterOption = findRelatedMatter(matterOptions, {
    matterId: formData.matter?.id,
    matterNo: formData.matterNo,
  });
  const historicalMatterOption =
    !matchedMatterOption && formData.matterNo
      ? {
          id: `history-snapshot:${formData.matterNo}`,
          Name: formData.matterNo,
          _historySnapshot: true,
        }
      : null;
  const visibleMatterOptions = historicalMatterOption
    ? [historicalMatterOption, ...matterOptions]
    : matterOptions;
  const selectedMatterOption =
    matchedMatterOption || historicalMatterOption || null;
  const matterHelperText = isMatterLoading
    ? ""
    : matterOptionsError ||
      (matterOptions.length === 0
        ? "No related matter found for this contact."
        : !selectedMatterOption
          ? "Select a related matter."
          : "");
  const formatMatterOptionLabel = (matter) => {
    const label = getMatterOptionLabel(matter);
    const duplicateCount = matterOptions.filter(
      (option) => getMatterOptionLabel(option) === label
    ).length;
    return duplicateCount > 1
      ? `${label} (${String(matter?.id || "").slice(-6)})`
      : label;
  };

  const handleMatterSelection = async (nextMatter) => {
    if (nextMatter?._historySnapshot) return;

    const requestId = matterSelectionRequest.current + 1;
    matterSelectionRequest.current = requestId;
    setIsMatterLoading(true);

    try {
      if (!nextMatter) {
        const metadata = await fetchMatterPicklistMetadata(null);
        if (matterSelectionRequest.current !== requestId) return;
        setFormData((previous) => ({
          ...previous,
          matter: null,
          matterNo: "",
          currentStage: "",
          matterProgress: "",
        }));
        setMatterMetadata(metadata);
        return;
      }

      let selectedMatter = nextMatter;
      try {
        selectedMatter = await fetchMatterById(nextMatter.id);
        if (!selectedMatter) {
          throw new Error("Zoho returned no Matter record.");
        }
      } catch (error) {
        console.warn("Could not hydrate selected Matter record:", error);
        throw new Error(
          "Could not load the selected Matter details. Please try again."
        );
      }

      const snapshot = buildMatterSnapshotFields(selectedMatter);
      const matterValues = matterFormValuesFromHistory({
        ...snapshot,
        Matter: selectedMatter,
      });
      const metadata = await fetchMatterPicklistMetadata(selectedMatter);
      if (matterSelectionRequest.current !== requestId) return;

      setFormData((previous) => ({
        ...previous,
        matter: matterValues.matter,
        matterNo: matterValues.matterNo,
        currentStage: matterValues.currentStage,
        matterProgress: matterValues.matterProgress,
      }));
      setMatterMetadata(metadata);
    } catch (error) {
      console.error("Could not select Matter:", error);
      if (matterSelectionRequest.current === requestId) {
        setSnackbar({
          open: true,
          message: error?.message || "Could not load the selected Matter.",
          severity: "error",
        });
      }
    } finally {
      if (matterSelectionRequest.current === requestId) {
        setIsMatterLoading(false);
      }
    }
  };

  const currentStageOptions = getStageOptions(
    matterMetadata,
    formData.currentStage
  );
  const currentProgressOptions = getProgressOptions(
    matterMetadata,
    formData.currentStage,
    formData.matterProgress
  );

  const handleCurrentStageChange = (nextStage) => {
    const normalizedStage = normalizePicklistValue(nextStage);
    const allowedProgress = getProgressOptions(matterMetadata, normalizedStage);
    const currentProgress = normalizePicklistValue(formData.matterProgress);

    setFormData((previous) => ({
      ...previous,
      currentStage: normalizedStage,
      matterProgress:
        currentProgress && !allowedProgress.includes(currentProgress)
          ? ""
          : currentProgress,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isMatterLoading) {
      setSnackbar({
        open: true,
        message: "Please wait for the matter details to finish loading.",
        severity: "info",
      });
      return;
    }

    // Validation: prevent submission with missing required data
    if (!selectedOwner) {
      setSnackbar({
        open: true,
        message: "Please select a Record Owner before saving.",
        severity: "error",
      });
      return;
    }

    let selectedParticipants = Array.isArray(formData?.Participants)
      ? formData.Participants.filter((c) => c && (c.id || c.Full_Name))
      : [];

    if (selectedParticipants.length === 0 && currentContact) {
      selectedParticipants = [currentContact];
    }

    if (selectedParticipants.length === 0) {
      setSnackbar({
        open: true,
        message: "Please add at least one contact (participant) before saving.",
        severity: "error",
      });
      return;
    }

    if (!formData?.type?.trim()) {
      setSnackbar({
        open: true,
        message: "Please select a Category before saving.",
        severity: "error",
      });
      return;
    }

    if (!formData?.result?.trim()) {
      setSnackbar({
        open: true,
        message: "Please select an Activity Type before saving.",
        severity: "error",
      });
      return;
    }

    setIsSubmitting(true);

    // Generate history name based on selected contacts
    const updatedHistoryName = selectedParticipants
      .map((c) => c?.Full_Name || c?.full_name || "")
      .filter(Boolean)
      .join(", ");

    const dateTimeFormatted = formData.date_time
      ? dayjs(formData.date_time).format("YYYY-MM-DDTHH:mm:ssZ")
      : null;

    const finalData = {
      Name: updatedHistoryName,
      History_Details_Plain: formData.details,
      Regarding: formData.regarding,
      Owner: selectedOwner?.id ? { id: selectedOwner.id } : selectedOwner,
      History_Result: Array.isArray(formData.result) && formData.result.length > 0
        ? formData.result[0]
        : formData.result,

      Stakeholder: formData.stakeHolder
        ? formData.stakeHolder
        : null,
      History_Type: formData.type || "",
      Duration: serializeDuration(formData.duration),
      Date: dateTimeFormatted,
      Matter_No: formData.matterNo || null,
      Current_Stage: formData.currentStage || null,
      Matter_Progress: serializeMultiSelectPicklist(formData.matterProgress),
      Billing_Type: formData.billingType || DEFAULT_BILLING_TYPE,
    };


    if (finalData.Stakeholder === "Unknown") {
      delete finalData.Stakeholder;
    }


    try {
      if (selectedRowData) {
        await updateHistory(selectedRowData, finalData, selectedParticipants);
      } else {
        await createHistory(finalData, selectedParticipants);
      }
      handleCloseDialog();
    } catch (error) {
      console.error("Error saving records:", error);
      setSnackbar({
        open: true,
        message: error?.message || "An error occurred. Please try again.",
        severity: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const logResponse = async ({ name, payload, response, result, trigger, meetingType, Widget_Source }) => {
    try {
      const timeOccurred = dayjs().tz("Australia/Adelaide").format("YYYY-MM-DDTHH:mm:ssZ");

      const logInsertResponse = await ZOHO.CRM.API.insertRecord({
        Entity: "Log_Module",
        APIData: {
          Name: name,
          Payload: JSON.stringify(payload),
          Response: JSON.stringify(response),
          Result: result,
          Trigger: trigger,
          Time_Occured: timeOccurred,
          Meeting_Type: meetingType || "",
          Widget_Source: Widget_Source
        },
      });

      // Log to console if log itself fails
      const logSuccess = logInsertResponse?.data?.[0]?.code === "SUCCESS";
      if (!logSuccess) {
        console.warn("⚠️ Log insert failed:", logInsertResponse);
      }
    } catch (err) {
      console.error("🚨 Error inserting into Log_Module:", err);
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

      const createResponse = await ZOHO.CRM.API.insertRecord(createConfig);

      const wasSuccessful = createResponse?.data[0]?.code === "SUCCESS";

      await logResponse({
        name: "Create History1",
        payload: JSON.stringify(finalData),
        response: createResponse,
        result: wasSuccessful ? "Success" : "Error",
        trigger: "Record Create",
        meetingType: finalData?.Type_of_Activity || "",
        Widget_Source: "Contact History"
      });

      if (!wasSuccessful) throw new Error("Failed to create History1 record.");

      const historyId = createResponse.data[0].details.id;

      if (formData?.attachment) {
        await zohoApi.file.uploadAttachment({
          module: "History1",
          recordId: historyId,
          data: formData?.attachment,
        });
      }

      let contactRecordIds = [];

      for (const contact of selectedParticipants) {
        try {
          const contactResponse = await ZOHO.CRM.API.insertRecord({
            Entity: "History_X_Contacts",
            APIData: {
              Contact_History_Info: { id: historyId },
              Contact_Details: { id: contact.id },
              ...buildJunctionSyncFields(finalData),
            },
            Trigger: ["workflow"],
          });
          requireSuccessfulRecordResponse(
            contactResponse,
            `Contact junction create for ${contact.id}`
          );
          contactRecordIds.push(contactResponse.data[0].details.id);
        } catch (error) {
          console.error(`Error inserting contact ${contact.id}:`, error);
          throw error;
        }
      }

      setSnackbar({
        open: true,
        message: "Record created successfully!",
        severity: "success",
      });

      const updatedRecord = {
        id: contactRecordIds[0] || null,
        ...finalData,
        Owner: buildViewOwner(selectedOwner),
        Participants: selectedParticipants,
        historyDetails: {
          name: selectedParticipants.map((c) => c.Full_Name).join(", "),
          id: historyId,
        },
      };

      if (onRecordAdded) onRecordAdded(updatedRecord);
    } catch (error) {
      await logResponse({
        name: "Create History1",
        payload: JSON.stringify(finalData),
        response: { error: error.message },
        result: "Error",
        trigger: "Record Create",
        meetingType: finalData?.Type_of_Activity || "",
        Widget_Source: "Contact History"
      });
      console.error("Error creating history:", error);
      throw error;
    }
  };


  const updateHistory = async (selectedRowData, finalData, selectedParticipants) => {


    if (selectedRowData.stakeHolder === "Unknown") {
      delete selectedRowData.stakeHolder;
    }

    try {
      const historyId = selectedRowData?.historyDetails?.id || selectedRowData?.history_id;



      const updateConfig = {
        Entity: "History1",
        RecordID: historyId,
        APIData: {
          id: historyId,
          ...finalData,
          Owner: { id: finalData?.Owner?.id },
        },
        Trigger: ["workflow"],
      };

      const updateResponse = await ZOHO.CRM.API.updateRecord(updateConfig);

      const wasSuccessful = updateResponse?.data[0]?.code === "SUCCESS";

      await logResponse({
        name: `Update History1: ${historyId}`,
        response: updateResponse,
        result: wasSuccessful ? "Success" : "Error",
        trigger: "Record Update",
        meetingType: finalData?.Type_of_Activity || "",
        Widget_Source: "Contact History"
      });

      if (!wasSuccessful) throw new Error("Failed to update record.");

      await zohoApi.file.deleteAttachment({
        module: "History1",
        recordId: historyId,
        attachment_id: loadedAttachmentFromRecord?.[0]?.id,
      });

      await zohoApi.file.uploadAttachment({
        module: "History1",
        recordId: historyId,
        data: formData?.attachment,
      });

      const relatedRecordsResponse = await ZOHO.CRM.API.getRelatedRecords({
        Entity: "History1",
        RecordID: historyId,
        RelatedList: "Contacts3",
      });

      const existingContacts = relatedRecordsResponse?.data || [];
      const existingContactIds = existingContacts.map(c => c.Contact_Details?.id);
      const selectedContactIds = selectedParticipants.map(c => c.id);

      await Promise.all(
        existingContacts
          .filter((record) => record?.id)
          .map(async (record) => {
            const response = await ZOHO.CRM.API.updateRecord({
              Entity: "History_X_Contacts",
              RecordID: record.id,
              APIData: buildJunctionSyncFields(finalData),
              Trigger: ["workflow"],
            });
            return requireSuccessfulRecordResponse(
              response,
              `Contact junction update for ${record.id}`
            );
          })
      );

      const toDeleteContactIds = existingContactIds.filter(id => !selectedContactIds.includes(id));
      const toAddContacts = selectedParticipants.filter(c => !existingContactIds.includes(c.id));

      for (const id of toDeleteContactIds) {
        const recordToDelete = existingContacts.find(c => c.Contact_Details?.id === id);
        if (recordToDelete?.id) {
          await ZOHO.CRM.API.deleteRecord({
            Entity: "History_X_Contacts",
            RecordID: recordToDelete.id,
          });
        }
      }

      for (const contact of toAddContacts) {
        try {
          const response = await ZOHO.CRM.API.insertRecord({
            Entity: "History_X_Contacts",
            APIData: {
              Contact_History_Info: { id: historyId },
              Contact_Details: { id: contact.id },
              ...buildJunctionSyncFields(finalData),
            },
            Trigger: ["workflow"],
          });
          requireSuccessfulRecordResponse(
            response,
            `Contact junction create for ${contact.id}`
          );
        } catch (error) {
          console.error(`Error inserting contact ${contact.id}:`, error);
          throw error;
        }
      }

      const updatedRecord = {
        id: selectedRowData.id || null,
        ...finalData,
        Owner: buildViewOwner(selectedOwner),
        Participants: selectedParticipants,
        Stakeholder: formData.stakeHolder || null,
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
    } catch (error) {
      await logResponse({
        name: `Update History1: ${selectedRowData?.history_id || "Unknown"}`,
        response: { error: error.message },
        result: "Error",
        trigger: "Record Update",
        meetingType: finalData?.Type_of_Activity || "",
        Widget_Source: "Contact History"
      });

      console.error("Error updating history:", error);
      throw error;
    }
  };


  const handleDelete = async () => {
    if (!selectedRowData) return; // No record selected

    const deleteId = selectedRowData?.historyDetails?.id || selectedRowData?.history_id;

    try {
      // Delete related records first
      if (deleteId) {
        const relatedRecordsResponse = await ZOHO.CRM.API.getRelatedRecords({
          Entity: "History1",
          RecordID: deleteId,
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
        RecordID: deleteId,
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

  // typeOptions is now derived from picklistConfig at the top of the component
  // (or falls back to the hard-coded list if picklistConfig is null)

  const [, setSelectedApplicationId] = React.useState(null);



  // const handleApplicationSelect = async () => {
  //   if (!selectedApplicationId) {
  //     setSnackbar({
  //       open: true,
  //       message: "Please select an application.",
  //       severity: "warning",
  //     });
  //     return;
  //   }

  //   const payload = {
  //     applicationId: selectedApplicationId,
  //     formData,
  //     contacts: historyContacts.map((c) => c.id),
  //   };

  //   try {
  //     // Delete the current history and associated contacts
  //     await handleDelete();

  //     const createApplicationHistory = await ZOHO.CRM.API.insertRecord({
  //       Entity: "Application History",
  //       APIData: {
  //         Name: formData.Name,
  //         Application: { id: selectedApplicationId },
  //         Details: formData.details,
  //         Date: formData.date_time,
  //       },
  //       Trigger: ["workflow"],
  //     });

  //     const wasSuccessful =
  //       createApplicationHistory?.data[0]?.code === "SUCCESS";

  //     await logResponse({
  //       name: `Move History to Application ${selectedApplicationId}`,
  //       payload,
  //       response: createApplicationHistory,
  //       result: wasSuccessful ? "Success" : "Error",
  //       trigger: "Move History to Application",
  //       meetingType: "", // not applicable
  //       Widget_Source: "Contact History"
  //     });

  //     if (!wasSuccessful) {
  //       throw new Error("Failed to create new application history.");
  //     }

  //     const newHistoryId = createApplicationHistory.data[0].details.id;

  //     // Log and create each contact relation
  //     for (const contact of historyContacts) {
  //       try {
  //         const contactLinkResponse = await ZOHO.CRM.API.insertRecord({
  //           Entity: "ApplicationxContacts",
  //           APIData: {
  //             Application_History: { id: newHistoryId },
  //             Contact: { id: contact.id },
  //           },
  //           Trigger: ["workflow"],
  //         });

  //         await logResponse({
  //           name: `Link Contact to Application History`,
  //           payload: {
  //             Application_History: newHistoryId,
  //             Contact: contact.id,
  //           },
  //           response: contactLinkResponse,
  //           result: contactLinkResponse?.data[0]?.code === "SUCCESS" ? "Success" : "Error",
  //           trigger: "Create ApplicationxContacts",
  //           meetingType: "",
  //           Widget_Source: "Contact History"
  //         });

  //       } catch (error) {
  //         await logResponse({
  //           name: `Failed Linking Contact ${contact.id}`,
  //           payload: {
  //             Application_History: newHistoryId,
  //             Contact: contact.id,
  //           },
  //           response: { error: error },
  //           result: "Error",
  //           trigger: "Create ApplicationxContacts",
  //           meetingType: "",
  //           Widget_Source: "Contact History"
  //         });
  //         console.error(`Error linking contact ${contact.id}:`, error);
  //       }
  //     }

  //     setSnackbar({
  //       open: true,
  //       message: "History moved successfully!",
  //       severity: "success",
  //     });
  //   } catch (error) {
  //     await logResponse({
  //       name: `Move History to Application ${selectedApplicationId}`,
  //       payload,
  //       response: { error: error },
  //       result: "Error",
  //       trigger: "Move History to Application",
  //       meetingType: "",
  //       Widget_Source: "Contact History"
  //     });

  //     console.error("Error moving history:", error);
  //     setSnackbar({
  //       open: true,
  //       message: "Failed to move history.",
  //       severity: "error",
  //     });
  //   } finally {
  //     handleApplicationDialogClose();
  //   }
  // };


  const handleApplicationDialogClose = () => {
    setOpenApplicationDialog(false);
    setSelectedApplicationId(null);
  };


  const [openConfirmDialog, setOpenConfirmDialog] = React.useState(false);

  const handleAttachmentDelete = async () => {
    await zohoApi.file.deleteAttachment({
      module: "History1",
      recordId: selectedRowData?.history_id,
      attachment_id: loadedAttachmentFromRecord?.[0]?.id,
    });

    // Update state to remove attachment
    setFormData((prev) => ({
      ...prev,
      attachment: null,
    }));

    setOpenConfirmDialog(false); // Close confirmation dialog

  }


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
            <Grid item xs={12} sm={3}>
              <Autocomplete
                fullWidth
                options={visibleMatterOptions}
                value={selectedMatterOption}
                loading={isMatterLoading}
                disabled={isMatterLoading}
                getOptionLabel={formatMatterOptionLabel}
                getOptionKey={(option) => String(option?.id || "")}
                isOptionEqualToValue={(option, value) =>
                  String(option?.id || "") === String(value?.id || "")
                }
                getOptionDisabled={(option) =>
                  Boolean(option?._historySnapshot)
                }
                onChange={(_, value) => handleMatterSelection(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    variant="standard"
                    label="Matter No"
                    helperText={matterHelperText}
                  />
                )}
                sx={{
                  "& .MuiInputBase-input, & .MuiInputLabel-root": {
                    fontSize: "9pt",
                  },
                }}
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth variant="standard" disabled={isMatterLoading}>
                <InputLabel sx={{ fontSize: "9pt" }}>Current Stage</InputLabel>
                <Select
                  value={formData.currentStage || ""}
                  onChange={(event) =>
                    handleCurrentStageChange(event.target.value)
                  }
                  label="Current Stage"
                  sx={{ "& .MuiSelect-select": { fontSize: "9pt" } }}
                >
                  <MenuItem value="" sx={{ fontSize: "9pt" }}>
                    <em>None</em>
                  </MenuItem>
                  {currentStageOptions.map((stage) => (
                    <MenuItem key={stage} value={stage} sx={{ fontSize: "9pt" }}>
                      {stage}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth variant="standard" disabled={isMatterLoading}>
                <InputLabel sx={{ fontSize: "9pt" }}>Matter Progress</InputLabel>
                <Select
                  value={formData.matterProgress || ""}
                  onChange={(event) =>
                    handleInputChange("matterProgress", event.target.value)
                  }
                  label="Matter Progress"
                  sx={{ "& .MuiSelect-select": { fontSize: "9pt" } }}
                >
                  <MenuItem value="" sx={{ fontSize: "9pt" }}>
                    <em>None</em>
                  </MenuItem>
                  {currentProgressOptions.map((progress) => (
                    <MenuItem
                      key={progress}
                      value={progress}
                      sx={{ fontSize: "9pt" }}
                    >
                      {progress}
                    </MenuItem>
                  ))}
                </Select>
                {!isMatterLoading &&
                  formData.currentStage &&
                  currentProgressOptions.length === 0 && (
                    <Typography
                      variant="caption"
                      color="error"
                      sx={{ mt: 0.5, fontSize: "8pt" }}
                    >
                      {matterMetadata.dependencyError
                        ? `Matter Progress rules could not be loaded. The ${conn_name} connection requires map_dependency.READ access.`
                        : "No Matter Progress values are mapped to this Current Stage in Zoho."}
                    </Typography>
                  )}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth variant="standard" disabled={isMatterLoading}>
                <InputLabel sx={{ fontSize: "9pt" }}>Billing Type</InputLabel>
                <Select
                  value={formData.billingType || DEFAULT_BILLING_TYPE}
                  onChange={(event) =>
                    handleInputChange("billingType", event.target.value)
                  }
                  label="Billing Type"
                  sx={{ "& .MuiSelect-select": { fontSize: "9pt" } }}
                >
                  {billingTypeOptions.map((billingType) => (
                    <MenuItem
                      key={billingType}
                      value={billingType}
                      sx={{ fontSize: "9pt" }}
                    >
                      {billingType}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Grid container spacing={1}>
            <Grid item xs={12} sm={6}>
              <FormControl
                fullWidth
                variant="standard"
                sx={{ fontSize: "9pt" }}
              >
                <InputLabel sx={{ fontSize: "9pt" }}>Category</InputLabel>
                <Select
                  value={formData.type || ""} // Ensure a fallback value
                  onChange={(e) => {
                    handleInputChange("type", e.target.value);
                    handleInputChange(
                      "result",
                      getResultOptions(e.target.value, picklistConfig)[0]
                    );
                    handleInputChange("regarding", getRegardingOptions(e.target.value, undefined, picklistConfig)[0]);
                    setSelectedType(e.target.value);
                  }}
                  label="Category"
                  sx={{
                    "& .MuiSelect-select": {
                      fontSize: "9pt",
                    },
                  }}
                >
                  {visibleTypeOptions.map((type) => (
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
                <InputLabel sx={{ fontSize: "9pt" }}>Activity Type</InputLabel>
                <Select
                  value={formData.result || ""} // Ensure a fallback value
                  onChange={(e) => {
                    handleInputChange("result", e.target.value);
                  }}
                  label="Activity Type"
                  sx={{
                    "& .MuiSelect-select": {
                      fontSize: "9pt",
                    },
                  }}
                >
                  {getResultOptions(
                    formData.type,
                    picklistConfig,
                    formData.result
                  ).map((result) => (
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

          <Stakeholder
            formData={formData}
            handleInputChange={handleInputChange}
            ZOHO={ZOHO}
          />

          <Grid container spacing={1}>
            <Grid
              item
              xs={6}
              sx={
                {
                  //overflow: "hidden", // Ensure the grid container doesn't allow overflow
                  // width: "98%",
                }
              }
            >
              <Box>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DemoContainer
                    components={["DateTimePicker"]}
                    sx={{
                      // overflow: "hidden", // Prevent overflow in the DemoContainer
                      pt: 0,
                    }}
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
                        // bgcolor: "green",
                        "& .MuiInputBase-input": {
                          fontSize: "9pt",
                        },
                        "& .MuiInputAdornment-root": {
                          marginLeft: "-31px", // Move the icon slightly to the left
                        },
                        "& .MuiSvgIcon-root": {
                          fontSize: "20px", // Adjust the icon size
                          p: 0,
                        },
                        overflow: "hidden", // Prevent overflow in the DateTimePicker
                      }}
                      slotProps={{
                        popper: {
                          modifiers: [
                            {
                              name: "offset",
                              options: {
                                offset: [80, -180], // You can adjust the offset if necessary
                              },
                            },
                          ],
                        },
                        textField: {
                          variant: "standard",
                          margin: "dense",
                        },
                      }}
                    />
                  </DemoContainer>
                </LocalizationProvider>
              </Box>
            </Grid>

            <Grid item xs={6}>
              <Autocomplete
                options={durationOptions || []}
                getOptionLabel={(option) => (option != null ? String(option) : "")}
                value={
                  formData?.duration == null
                    ? null
                    : (durationOptions || []).find(
                        (d) => Number(d) === Number(formData.duration)
                      ) ?? formData.duration
                }
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
                options={ownerList || []}
                getOptionLabel={(option) => option?.full_name || ""}
                value={selectedOwner ?? null}
                onChange={(event, newValue) => {
                  setSelectedOwner(newValue);
                  // handleInputChange("ownerName", newValue)
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Record Owner"
                    name="history_owner"
                    variant="standard"
                    sx={{
                      "& .MuiInputLabel-root": { fontSize: "9pt" }, // Label size
                      "& .MuiInputBase-input": { fontSize: "9pt" }, // Input text size
                    }}
                  />
                )}
                slotProps={{
                  popper: {
                    modifiers: [
                      {
                        name: "preventOverflow",
                        options: {
                          boundary: "window",
                        },
                      },
                    ],
                  },
                  paper: {
                    sx: {
                      "& .MuiAutocomplete-listbox": {
                        fontSize: "9pt", // Option size
                      },
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={6}>
              <RegardingField
                formData={formData}
                handleInputChange={handleInputChange}
                selectedRowData={selectedRowData}
                picklistConfig={picklistConfig}
              />
            </Grid>
          </Grid>

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
                endAdornment: formData?.attachment?.name ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      // onClick={handleAttachmentDelete}
                      onClick={() => setOpenConfirmDialog(true)}
                      sx={{ padding: 0.5 }}
                    >
                      <Close fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
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
            </Button>
          </Box>
          <Modal
            open={openConfirmDialog}
            onClose={() => setOpenConfirmDialog(false)}
          >
            <Paper sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              padding: 3,
              width: 300,
              textAlign: "center",
              boxShadow: 24,
            }}>
              <Typography id="confirm-delete-modal" variant="h6">
                Confirm Deletion
              </Typography>
              <Typography variant="body2" sx={{ marginY: 2 }}>
                Are you sure you want to delete this attachment? This action cannot be undone.
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                <Button onClick={() => setOpenConfirmDialog(false)} color="primary">
                  Cancel
                </Button>
                <Button onClick={handleAttachmentDelete} color="error">
                  Delete
                </Button>
              </Box>
            </Paper>

            {/* <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogContent>
            Are you sure you want to delete this attachment? This action cannot be undone.
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenConfirmDialog(false)} color="primary">
                Cancel
              </Button>
              <Button onClick={handleAttachmentDelete} color="error">
                Delete
              </Button>
            </DialogActions> */}
          </Modal>

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
            <div>
              <Button
                onClick={handleDelete}
                variant="outlined"
                color="error"
                disabled={isSubmitting}
                sx={{
                  fontSize: "9pt",
                  marginLeft: "8px",
                  textTransform: "none",
                  padding: "4px 8px",
                }}
              >
                Delete
              </Button>
              <Button
                onClick={handleMoveToApplication}
                variant="outlined"
                color="success"
                disabled={isSubmitting}
                sx={{
                  fontSize: "9pt",
                  marginLeft: "8px",
                  textTransform: "none",
                  padding: "4px 8px",
                }}
              >
                Move to Application
              </Button>
              {/*               
              <Button
                onClick={handleMoveToApplication}
                variant="outlined"
                color="success"
                sx={{
                  fontSize: "9pt",
                  marginLeft: "8px",
                  textTransform: "none",
                  padding: "4px 8px",
                }}
              >
                Move to Application
              </Button> */}
            </div>
          ) : (
            <div></div>
          )}
          <Box sx={{ display: "flex", gap: 1 }}>
            {" "}
            <Button
              onClick={handleCloseDialog}
              variant="outlined"
              disabled={isSubmitting}
              sx={{ fontSize: "9pt" }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || isMatterLoading}
              sx={{ fontSize: "9pt" }}
            >
              {isSubmitting || isMatterLoading ? (
                <>
                  <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                  {isSubmitting ? "Saving..." : "Loading matter..."}
                </>
              ) : (
                buttonText
              )}
            </Button>
          </Box>
        </DialogActions>
      </MUIDialog>
      <ApplicationDialog
        openApplicationDialog={openApplicationDialog}
        handleApplicationDialogClose={handleApplicationDialogClose}
        applications={applications}
        ZOHO={ZOHO}
        handleDelete={handleDelete}
        formData={formData}
        historyContacts={historyContacts}
        selectedRowData={selectedRowData}
        currentContact={currentContact}
        selectedOwner={selectedOwner}
      />
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
