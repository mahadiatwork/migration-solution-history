import * as React from "react";
import {
  getRecordDetails,
  getRecordDetailsFromRelatedList,
  getEmailTemplateRestAPI,
} from "../util/zohoutil";

const ZOHO = window.ZOHO;

export const useZoho = ({
  setAllData,
  setRecordData,
  setRecordDataLoading,
  setSelected,
  setRows,
  setRowsWithEmail,
  setRowsLoading,
  setTemplates,
  setTemplatesLoading,
  widgetHeight,
  widgetWidth,
  trainerId,
}) => {
  const [initZoho, setInitZoho] = React.useState(false);
  const [module, setModule] = React.useState(null);
  const [recordId, setRecordId] = React.useState(null);
  let allData;

  React.useEffect(() => {
    ZOHO.embeddedApp.on("PageLoad", async function (data) {
      setModule(data?.Entity);
      setRecordId(data?.EntityId[0]);
    });
    ZOHO.embeddedApp.init().then(() => {
      setInitZoho(true);
    });
  }, []);

  React.useEffect(() => {
    if (initZoho && module && recordId) {
      if (widgetHeight && widgetWidth) {
        try {
          ZOHO.CRM.UI.Resize({ height: widgetHeight, width: widgetWidth }).then(
            function (resizeData) {
              //console.log({ resizeData });
            }
          );
        } catch (setWidgetSize) {
          // console.log({ setWidgetSize });
        }
      }
      //------
      getRecordDetails({
        module,
        recordId,
        setData: setRecordData,
        setLoading: setRecordDataLoading,
      });
      //------
      getEmailTemplateRestAPI({
        setLoading: setTemplatesLoading,
        setData: setTemplates,
        module: "Trainingen_X_Contacts",
      });
      //------
    }
  }, [initZoho, recordId]);

  React.useEffect(() => {
    getRecordDetailsFromRelatedList({
      module,
      recordId,
      RelatedListAPI: "Contacts1",
      setData: setRows,
      destinationModule: "Contacts",
      setLoading: setRowsLoading,
      setRowsWithEmail,
      setSelected,
      trainerId,
    });
  }, [recordId, trainerId]);

  return {
    initZoho,
    module,
    recordId,
    allData,
  };
};
