export const buttonPositions = {
  ListView: "ListView",
  DetailView: "DetailView",
  ListViewEachRecord: "ListViewEachRecord",
  ListViewWithoutRecord: "ListViewWithoutRecord",
  BlueprintView: undefined,
};

export const moduleNameMap = (name) => {
  const obj = {
    Leads: "Full_Name",
    Contacts: "Full_Name",
    Accounts: "Account_Name",
    Deals: "Deal_Name",
    Products: "Product_Name",
    Tasks: "Subject",
    Events: "Event_Title",
    Quotes: "Subject",
    Invoices: "Subject",
    Purchase_Orders: "Subject",
    Sales_Orders: "Subject",
    // Campaigns: "Subject",
    // Cases: "Subject",
  };

  return obj[name] || "Name";
};

export const specialModules = [
  "Quotes",
  "Invoices",
  "Purchase_Orders",
  "Sales_Orders",
];

export const settingType = { CustomAction: "CustomAction" };

export const editor = {
  template: "template",
  rich_text: "rich_text",
};

export const dataCenterMap = {
  US: "https://www.zohoapis.com",
  EU: "https://www.zohoapis.eu",
  AU: "https://www.zohoapis.com.au",
  IN: "https://www.zohoapis.in",
  China: "https://www.zohoapis.com.cn",
  JP: "https://www.zohoapis.jp",
};
