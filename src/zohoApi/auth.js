import axios from "axios";
import {
  DATA_CENTER_URL_API_NAME,
  EXTENSION_IDENTIFIER,
  IS_SANDBOX,
  API_KEYS,
} from "../config/serviceConstant";
import { dataCenterMap } from "../config/zohoConstant";

const ZOHO = window.ZOHO;

const setUpDataCenterUrl = async ({
  ZOHO,
  IS_SANDBOX,
  EXTENSION_IDENTIFIER,
  DATA_CENTER_URL_API_NAME,
}) => {
  try {
    const currentEnv = await ZOHO.CRM.CONFIG.GetCurrentEnvironment();
    let dataCenterUrl = dataCenterMap?.[currentEnv?.deployment] || "";
    if (IS_SANDBOX === "true") {
      dataCenterUrl = `https://plugin-${EXTENSION_IDENTIFIER}.zohosandbox.com`;
    }
    const dataCenterData = {
      apiname: DATA_CENTER_URL_API_NAME,
      value: dataCenterUrl,
    };
    await ZOHO.CRM.CONNECTOR.invokeAPI("crm.set", dataCenterData);
    return dataCenterUrl;
  } catch (setUpDataCenterUrlError) {
    console.log({ setUpDataCenterUrlError });
    return null;
  }
};

const fetchOrgVariablesData = async ({ dataCenterUrl, API_KEYS }) => {
  try {
    const orgData = { apiKeys: API_KEYS };
    const orgVariables = await ZOHO.CRM.API.getOrgVariable(orgData);

    let tempUrlValue =
      orgVariables?.Success?.Content?.[
        `${process.env.REACT_APP_EXTENSION_IDENTIFIER}__Data_Center_URL`
      ]?.value;

    let tempDataCenterUrl =
      tempUrlValue && tempUrlValue !== "null" ? tempUrlValue : dataCenterUrl;

    let tempApiKey =
      orgVariables?.Success?.Content?.[
        `${process.env.REACT_APP_EXTENSION_IDENTIFIER}__API_KEY`
      ]?.value;

    let tempOrgId =
      orgVariables?.Success?.Content?.[
        `${process.env.REACT_APP_EXTENSION_IDENTIFIER}__Organization_ID`
      ]?.value;

    let tempZapiKey =
      orgVariables?.Success?.Content?.[
        `${process.env.REACT_APP_EXTENSION_IDENTIFIER}__ZAPI_Key`
      ]?.value;

    const orgResp = await ZOHO.CRM.CONFIG.getOrgInfo();
    let tempZuid = await orgResp?.org?.[0]?.primary_zuid;

    return {
      dataCenterUrl: tempDataCenterUrl,
      apiKey: tempApiKey,
      orgId: tempOrgId,
      zapiKey: tempZapiKey,
      zuid: tempZuid,
    };
  } catch (fetchOrgVariablesDataError) {
    console.log({ fetchOrgVariablesDataError });
  }
};

const handleAuthCheckZoho = async ({ headers, dataCenterUrl }) => {
  try {
    if (
      !dataCenterUrl ||
      !headers.apikey ||
      !headers.orgid ||
      !headers.accountsurl ||
      !headers.connname ||
      !headers.dataCenterurlvariablename
    ) {
      console.log("missing header values in handleAuthCheckZoho");
      return false;
    }
    // for zoho auth verify
    const authCheckConig = {
      url: `${process.env.REACT_APP_ADMIN_SERVER_URL}/auth/zoho/verifyauth`,
      headers: headers,
    };
    const authCheck = await axios(authCheckConig);

    return authCheck?.data?.org?.length > 0 ? true : false;
  } catch (handleAuthCheckZohoError) {
    console.log({ handleAuthCheckZohoError });
    return false;
  }
};

async function getAccessToken({ apiKey, orgId }) {
  try {
    const url = `${process.env.REACT_APP_ADMIN_SERVER_URL}/auth/zoho/accesstoken`;
    // const url = "https://api.easy-pluginz.com/admin/v2/auth/zoho/accesstoken";
    const access_config = {
      url: url,
      headers: {
        apikey: apiKey,
        orgid: orgId,
        connname: process.env.REACT_APP_EXTENSION_IDENTIFIER + "__zoho",
      },
    };
    const resp = await axios(access_config);
    return { data: resp?.data?.data?.accessToken, error: null };
  } catch (getAccessTokenError) {
    console.log({ getAccessTokenError });
    return {
      data: null,
      error: "Something went wrong",
    };
  }
}

const createExtensionWidgets = async ({ dataCenterUrl, apiKey, orgId }) => {
  try {
    const connname = process.env.REACT_APP_EXTENSION_IDENTIFIER + "__zoho";
    const url = `${process.env.REACT_APP_ADMIN_SERVER_URL}/data/zoho/crm/extwidgets`;
    const config = {
      url,
      method: "POST",
      data: {
        widgetName: "Email by Easy Pluginz",
        widgetUrl: `https://widgets.v1.${process.env.REACT_APP_EXTENSION_IDENTIFIER}.easy-pluginz.com/buttons`,
        widgetDescription:
          "This widget you can be used in any Standard and Custom Module to send Emails",
        widgetType: "CUSTOM_BUTTON",
        apiDomain: dataCenterUrl,
      },
      headers: {
        connname,
        orgid: orgId,
        apikey: apiKey,
        datacenterurl: dataCenterUrl,
      },
    };
    const resp = await axios.request(config);
  } catch (createExtensionError) {
    console.log({ createExtensionError });
  }
};

export const handleAuthenticateZoho = async (
  { orgId, apiKey, zapiKey, dataCenterUrl, zuid },
  callback
) => {
  try {
    const authUrlResp = await axios.request({
      url: process.env.REACT_APP_ADMIN_SERVER_URL + "/auth/zoho/authenticate",
      method: "POST",
      data: {
        orgId: orgId,
        apiKey: apiKey,
        zapiKey: zapiKey,
        accountsUrl:
          "https://accounts.zoho." +
          dataCenterUrl?.split("https://www.zohoapis.")?.[1],
        connName: process.env.REACT_APP_EXTENSION_IDENTIFIER + "__zoho",
        scope: [
          "ZohoCRM.users.CREATE",
          "ZohoCRM.users.READ",
          "ZohoCRM.users.UPDATE",
          "ZohoCRM.org.READ",
          "ZohoCRM.org.UPDATE",
          "ZohoCRM.settings.CREATE",
          "ZohoCRM.settings.READ",
          "ZohoCRM.settings.UPDATE",
          "ZohoCRM.coql.READ",
          "ZohoCRM.modules.CREATE",
          "ZohoCRM.modules.READ",
          "ZohoCRM.modules.UPDATE",
          "ZohoCRM.send_mail.all.CREATE",
          "ZohoCRM.modules.ALL",
          "ZohoCRM.settings.emails.READ",
          "ZohoCRM.modules.ALL",
          "ZohoCRM.settings.mailmerge.CREATE",
          "ZohoWriter.documentEditor.ALL",
          "ZohoWriter.merge.ALL",
        ],
        redirectUrl: `${process.env.REACT_APP_ADMIN_SERVER_URL}/auth/zoho/callback`,
        crmApiDomain: dataCenterUrl,
        zuid: zuid,
      },
    });

    let popup;
    if (authUrlResp?.data?.authUrl) {
      // if popup return null, disable pop-up blocker.
      popup = window.open(
        authUrlResp?.data?.authUrl,
        "authUrlWindow",
        "height=640,width=1024"
      );
      if (!popup || popup.closed || typeof popup.closed == "undefined") {
        alert(
          "Popup window was blocked by the browser. Please allow popups for this site."
        );
      }
    }

    const closePopup = () => {
      // popup.close();
    };

    const myAuthCheckInterval = setInterval(async () => {
      const authCheckStatus = await handleAuthCheckZoho({
        headers: {
          orgid: orgId,
          apikey: apiKey,
          accountsurl: dataCenterUrl,
          connname: process.env.REACT_APP_EXTENSION_IDENTIFIER + "__zoho",
          dataCenterurlvariablename:
            process.env.REACT_APP_EXTENSION_IDENTIFIER + "__Data_Center_URL",
        },
        dataCenterUrl,
      });

      if (authCheckStatus) {
        await createExtensionWidgets({ dataCenterUrl, apiKey, orgId });
        clearInterval(myAuthCheckInterval);
        callback(
          {
            zohoAuthenticated: authCheckStatus,
            orgId,
            apiKey,
            zapiKey,
            dataCenterUrl,
            zuid,
          },
          null
        );
        closePopup();
      }
    }, 5000);
  } catch (handleAuthenticateZohoError) {
    console.log({ handleAuthenticateZohoError });
    callback(null, { message: "handleAuthenticateZoho error" });
  }
};

export const handleRevokeZoho = async ({ orgId, apiKey }) => {
  // orgId = "4731441000000297037",
  // apiKey = "JVMT304-D474ZF4-MGXASPZ-FRJT5X8",
  try {
    const authUrlResp = await axios.request({
      url: process.env.REACT_APP_ADMIN_SERVER_URL + "/auth/zoho/revoke",
      method: "GET",
      headers: {
        orgid: orgId,
        apikey: apiKey,
        connname: process.env.REACT_APP_EXTENSION_IDENTIFIER + "__zoho",
      },
    });
    // console.log(authUrlResp);
    if (authUrlResp?.data?.error === null) {
      return {
        zohoAuthenticated: false,
      };
    }
  } catch (handleRevokeZohoError) {
    console.log({ handleRevokeZohoError });
  }
};

export async function resizeWindow({ height, width }) {
  try {
    const resizeResp = await ZOHO.CRM.UI.Resize({ height, width });
  } catch (resizeWindowError) {
    console.log({ resizeWindowError });
  }
}

export async function initZoho(callback, { height, width }, initCallback) {
  ZOHO.embeddedApp.on("PageLoad", async function (initialData) {
    try {
      callback(initialData, null);
    } catch (initZohoError) {
      console.log({ initZohoError });
      callback({}, { message: "initzoho error" });
    }
  });

  ZOHO.embeddedApp
    .init()
    .then(() => {
      if (height && width) {
        resizeWindow({ height, width });
      }
      initCallback?.(true);
    })
    .catch((initZohoInitError) => {
      console.log({ initZohoInitError });
    });
}

export async function initZohoAuth(
  callback,
  { height, width },
  initCallback,
  checkZohoAuth
) {
  try {
    initZoho(
      async (initialData) => {
        const dataCenterUrl = await setUpDataCenterUrl({
          ZOHO,
          IS_SANDBOX,
          EXTENSION_IDENTIFIER,
          DATA_CENTER_URL_API_NAME,
        });

        const {
          apiKey,
          orgId,
          zapiKey,
          zuid,
          dataCenterUrl: newDataCenterUrl,
        } = await fetchOrgVariablesData({ dataCenterUrl, API_KEYS });

        const { data: accessToken } = await getAccessToken({
          apiKey,
          orgId,
        });

        let isAuthenticated;
        if (checkZohoAuth) {
          isAuthenticated = await handleAuthCheckZoho({
            headers: {
              apikey: apiKey,
              orgid: orgId,
              accountsurl: newDataCenterUrl,
              connname: `${process.env.REACT_APP_EXTENSION_IDENTIFIER}__zoho`,
              dataCenterurlvariablename: `${process.env.REACT_APP_EXTENSION_IDENTIFIER}__Data_Center_URL`,
            },
            dataCenterUrl: newDataCenterUrl,
          });
        }

        callback(
          {
            zohoAuthenticated: isAuthenticated,
            orgId,
            apiKey,
            zapiKey,
            dataCenterUrl: newDataCenterUrl,
            zuid,
            initialData,
            accessToken,
          },
          null
        );
      },
      { height, width },
      (initZoho) => {
        initCallback?.(initZoho);
      }
    );
  } catch (initZohoAuthError) {
    callback(null, { message: "initzohoauth error" });
    console.log({ initZohoAuthError });
  }
}

export const auth = {
  initZoho,
  initZohoAuth,
  resizeWindow,
  handleRevokeZoho,
  handleAuthenticateZoho,
  getAccessToken,
};
