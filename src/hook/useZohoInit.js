import { useState, useEffect } from "react";

import { zohoApi } from "../zohoApi";

export const useZohoInit = ({ height, width } = {}) => {
  const [initZoho, setInitZoho] = useState(false);
  const [module, setModule] = useState(null);
  const [recordId, setRecordId] = useState(null);

  useEffect(() => {
    zohoApi.auth.initZoho(
      (data, error) => {
        const { module, recordId } = data;
        setModule(module);
        setRecordId(recordId);
      },
      { height, width },
      (initZoho) => {
        setInitZoho(initZoho);
      }
    );
  }, [height, width]);

  return {
    initZoho,
    module,
    recordId,
  };
};
