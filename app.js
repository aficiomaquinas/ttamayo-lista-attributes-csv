const Papa = require('papaparse');
const fs = require('fs');
const slugify = require('slugify');

function getColumnNrByName(arr, name) {
  for (let col in arr[0]) {
    if (arr[0][col] == name) {
      return parseInt(col);
    }
  }
}

function getColumnAttrDataByRegex(arr, getNameRegex, getInfoRegex) {
  let result = [];
  for (let col in arr[0]) {
    if (arr[0][col].match(getNameRegex)) {
      // return parseInt(col);
      result.push({
        index: parseInt(col, 10),
        name: arr[0][col],
        attrNum: parseInt(arr[0][col].match(getInfoRegex)[0], 10),
      })
    }
  }
  return result;
}

function childrenAttributeValues(parentSKU, arr) {
  const parentColumnNum = getColumnNrByName(arr, "parent_sku");
  const valueRegex = /Attribute \d+ Value\(s\)/g;
  const nameRegex = /Attribute \d+ Name/g;
  const dataRegex = /Attribute \d+ Data/g;
  const globalRegex = /Attribute \d+ Global/g;
  const attributeNameColumns = getColumnAttrDataByRegex(arr, nameRegex, /\d+/g);
  const attributeValueColumns = getColumnAttrDataByRegex(arr, valueRegex, /\d+/g);
  const attributeDataColumns = getColumnAttrDataByRegex(arr, dataRegex, /\d+/g);
  const attributeGlobalColumns = getColumnAttrDataByRegex(arr, globalRegex, /\d+/g);
  const attributes = {};
  const children = arr.filter(row => row[parentColumnNum] == parentSKU);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    for (let i = 0; i < child.length; i++) {
      const headerIsNameAttr = arr[0][i].match(nameRegex);
      // Current cell has attribute name and column name is attribute name
      if (child[i] && headerIsNameAttr && headerIsNameAttr.length) {
        const attrName = attributeNameColumns.filter(obj => {
          return obj.index === i;
        });
        const attrValue = attributeValueColumns.filter(obj => {
          return obj.attrNum === attrName[0].attrNum;
        });
        const attrData = attributeDataColumns.filter(obj => {
          return obj.attrNum === attrName[0].attrNum;
        });
        const attrGlobal = attributeGlobalColumns.filter(obj => {
          return obj.attrNum === attrName[0].attrNum;
        });
        if (!attributes[child[i]]) {
          attributes[child[i]] = {};
          attributes[child[i]].values = [];
          attributes[child[i]].data = [];
          attributes[child[i]].global = [];
          attributes[child[i]].prices = [];
        }
        attributes[child[i]].values.push(child[attrValue[0].index]);
        attributes[child[i]].data.push(child[attrData[0].index]);
        attributes[child[i]].global.push(child[attrGlobal[0].index]);
        attributes[child[i]].prices.push({
          price: parseFloat(child[getColumnNrByName(arr, "regular_price")]),
          value: child[attrValue[0].index],
        });
      }
    }
  }
  for (const key in attributes) {
    if (attributes.hasOwnProperty(key)) {
      const attr = attributes[key];
      if (attr.values && attr.values.length) {
        attr.values = attr.values.filter((v, i, a) => a.indexOf(v) === i).join("|");
      }
      if (attr.data && attr.data.length) {
        attr.data = attr.data[0];
      }
      if (attr.global && attr.global.length) {
        attr.global = attr.global[0];
      }
      if (attr.prices && attr.prices.length) {
        const withPrices = attr.prices.filter((o) => o.price > 0);
        const lowestPrice = Math.min(...withPrices.map((o) => o.price));
        const def = attr.prices.filter((o) => o.price == lowestPrice)[0] 
        attr.def = def && def.value ? def.value : "";
      }
      attr.name = key;
    }
  }
  return Object.values(attributes);
}
    
function getNewColumnNamesFromArrAttrs(arr) {
  const attrNames = [];
  const attrProps = [];
  const nameRegex = /Attribute \d+ Name/g;
  const globalRegex = /Attribute \d+ Global/g;
  const attributeNameColumns = getColumnAttrDataByRegex(arr, nameRegex, /\d+/g);
  const attributeGlobalColumns = getColumnAttrDataByRegex(arr, globalRegex, /\d+/g);
  for (let row = 1; row < arr.length; row++) {
    for (let i = 0; i < arr[row].length; i++) {
      const currentCellVal = arr[0][i];
      const headerIsNameAttr = currentCellVal.match(nameRegex);
      if (currentCellVal && headerIsNameAttr && headerIsNameAttr.length) {
        const attrs = {
          name: attributeNameColumns.filter(o => o.index === i)[0],
        };
        attrs.global = attributeGlobalColumns.filter(o => o.attrNum === attrs.name.attrNum)[0];
        const currentAttrs = {
          name: arr[row][attrs.name.index],
          global: arr[row][attrs.global.index] == "1",
        }
        if (currentAttrs.name && !attrNames.includes((currentAttrs.global ? "pa_" : "") + currentAttrs.name)) {
          attrNames.push((currentAttrs.global ? "pa_" : "") + currentAttrs.name);
          attrProps.push({
            name: currentAttrs.name,
            global: currentAttrs.global,
          });
        }
      }
    }
  }
  return attrProps;
}

function addColumns2DArrFromHeader(arr) {
  // expand all rows to have the correct amount of cols
  for (var i = 1; i < arr[0].length; i++) {
    for (var j =  arr[i].length; j < arr[0].length; j++) {
        arr[i].push("");
    }
  }
  return arr;
}

function addColumnsFromAttributes(arr) {
  const newColumns = [];
  const attrProps = getNewColumnNamesFromArrAttrs(arr);
  const newArr = arr;
  const originalArrLength = arr[0].length;
  for (let i = 0; i < attrProps.length; i++) {
    const prop = attrProps[i];
    const propName = slugify(prop.name);
    if (prop.global) {
      newColumns.push("attribute:pa_" + propName);
      newColumns.push("attribute_data:pa_" + propName);
      newColumns.push("attribute_default:pa_" + propName);
      newColumns.push("meta:attribute_pa_" + propName);
    } else {
      newColumns.push("attribute:" + propName);
      newColumns.push("attribute_data:" + propName);
      newColumns.push("attribute_default:" + propName);
      newColumns.push("meta:attribute_" + propName);
    }
  }
  for (let i = 0; i < newColumns.length; i++) {
    const columnName = newColumns[i];
    newArr[0][originalArrLength + i] = columnName;
  }
  return addColumns2DArrFromHeader(newArr);
}

function addVariationAttrsToParents(arr) {
  const typeColumnNum = getColumnNrByName(arr, "tax:product_type");
  const newArr = arr.map((r) => {
    let row = r;
    if (row[typeColumnNum] == "variable") {
      const skuColumnNum = getColumnNrByName(arr, "sku");
      const parentSKU = row[skuColumnNum];
      const childrenAttrs = childrenAttributeValues(parentSKU, arr);
      for (let i = 0; i < childrenAttrs.length; i++) {
        const childrenAttrsVal = childrenAttrs[i];
        const glob = childrenAttrsVal.global == "1" ? "pa_" : "";
        const name = glob + slugify(childrenAttrsVal.name);
        const usedInVariations = childrenAttrsVal.data.substr(-1) == "1" ? true : false;
        row[getColumnNrByName(arr, `attribute:${name}`)] = childrenAttrsVal.values;
        row[getColumnNrByName(arr, `attribute_data:${name}`)] = childrenAttrsVal.data;
        row[getColumnNrByName(arr, `attribute_default:${name}`)] = usedInVariations ? childrenAttrsVal.def : "";
        // row[getColumnNrByName(arr, `attribute_default:${name}`)] = "";
        row[getColumnNrByName(arr, `meta:attribute_${name}`)] = "";
      }
    // Any other type of product
    } else if (row[typeColumnNum] || row[getColumnNrByName(arr, "post_title")]) {
      const nameRegex = /Attribute \d+ Name/g;
      const globalRegex = /Attribute \d+ Global/g;
      const dataRegex = /Attribute \d+ Data/g;
      const valueRegex = /Attribute \d+ Value\(s\)/g;
      const usedAttributeNameColumns = getColumnAttrDataByRegex(arr, nameRegex, /\d+/g).filter((i) => {
        return row[i.index];
      });
      const usedAttributeValColumns = getColumnAttrDataByRegex(arr, valueRegex, /\d+/g).filter((i) => {
        return row[i.index];
      });
      const usedAttributeGlobalColumns = getColumnAttrDataByRegex(arr, globalRegex, /\d+/g).filter((i) => {
        return row[i.index];
      });
      const usedAttributeDataColumns = getColumnAttrDataByRegex(arr, dataRegex, /\d+/g).filter((i) => {
        return row[i.index];
      });
      for (let i = 0; i < usedAttributeValColumns.length; i++) {
        const attrVal = usedAttributeValColumns[i];
        const attrGlobal = usedAttributeGlobalColumns[i];
        const attrData = usedAttributeDataColumns[i];
        const attrName = usedAttributeNameColumns.filter((nameObj) => nameObj.attrNum == attrVal.attrNum)[0];
        if (attrName) {
          const val = row[attrVal.index];
          const data = row[attrData.index];
          const glob = row[attrGlobal.index] == "1" ? "pa_" : "";
          const name = glob + slugify(row[attrName.index]);
          if (row[typeColumnNum] == "variation") {
            row[getColumnNrByName(arr, `meta:attribute_${name}`)] = val;
          } else {
            row[getColumnNrByName(arr, `attribute:${name}`)] = val;
            row[getColumnNrByName(arr, `attribute_data:${name}`)] = data;
          }
        }
      }
    }
    return row;
  });
  return newArr;
}

function removeUnusedCols(arr, usedColNames) {
  let usedColIndexes = [];
  for (let usedCol = 0; usedCol < usedColNames.length; usedCol++) {
    for (let i = 0; i < arr[0].length; i++) {
      if (usedColNames[usedCol] instanceof RegExp) {
        const matches = arr[0][i].match(usedColNames[usedCol]);
        if (matches && matches.length) {
          usedColIndexes.push(i);
        }
      } else if (typeof usedColNames[usedCol] === "string" && usedColNames[usedCol] === arr[0][i]) {
        usedColIndexes.push(i);
      }
    }
  }
  let newArr = [];
  for (let i = 0; i < arr.length; i++) {
    let newRow = [];
    for (let j = 0; j < usedColIndexes.length; j++) {
      newRow.push(arr[i][usedColIndexes[j]]);
    }
    newArr.push(newRow);
  }
  return newArr;
}

function main() {
  const allCols = [
    "tax:product_type",
    "post_type",
    "menu_order",
    "post_status",
    "post_title",
    "post_date",
    "post_content",
    "post_excerpt",
    "post_parent",
    "post_password",
    "visibility",
    "sku",
    "upsell_skus",
    "upsell_ids",
    "crosssell_skus",
    "crosssell_ids",
    "featured",
    "downloadable",
    "virtual",
    "regular_price",
    "sale_price",
    "manage_stock",
    "stock",
    "stock_status",
    "backorders",
    "weight",
    "length",
    "width",
    "height",
    "tax_status",
    "tax_class",
    "tax:product_shipping_class",
    "sale_price_dates_from",
    "sale_price_dates_to",
    "images",
    "product_url",
    "button_text",
    "meta:_sold_individually",
    "meta:total_sales",
    "tax:product_cat",
    "tax:product_tag",
    
  ];

  const productCols = [
    ...allCols,
    /attribute:.*/g,
    /attribute_data:.*/g,
  ];

  const variableCols = [
    ...allCols,
    /attribute:.*/g,
    /attribute_data:.*/g,
    /attribute_default:.*/g,
  ];
  
  const variationCols = [
    "parent_sku",
    "post_status",
    "sku",
    "downloadable",
    "virtual",
    "regular_price",
    "sale_price",
    "stock_status",
    "stock",
    "manage_stock",
    "weight",
    "length",
    "width",
    "height",
    "tax_status",
    "images",
    /meta:attribute_.*/g,
  ];

  const variationAndVariableCols = [
    ...new Set(variationCols.concat(variableCols)),
  ];

  const fileNames = process.argv.splice(2);
  const listaCsv = fs.readFileSync(fileNames[0], 'utf8');
  const lista = Papa.parse(listaCsv);
  
  const arrWithNewCols = addColumnsFromAttributes(lista.data);
  const newData = addVariationAttrsToParents(arrWithNewCols);
  
  const filterRowsByColumnValue = (arr, colName, colVal, inverse) => {
    if (inverse) {
      return arr.filter((row) => row[getColumnNrByName(arr, colName)] != colVal);
    } else {
      return [arr[0], ...arr.filter((row) => row[getColumnNrByName(arr, colName)] == colVal)];
    }
  }

  const outVariables = filterRowsByColumnValue(newData, "tax:product_type", "variable", false);
  const outVariations = filterRowsByColumnValue(newData, "tax:product_type", "variation", false);
  const outRemaining = filterRowsByColumnValue(filterRowsByColumnValue(newData, "tax:product_type", "variation", true), "tax:product_type", "variable", true);

  const outVariationsAndVariablesArr = [
    ...outVariables.concat(outVariations.slice(1)),
  ];
  
  const outRemainingCSV = Papa.unparse(
    removeUnusedCols(
      outRemaining
    , productCols)
  );

  const outVariablesCSV = Papa.unparse(
    removeUnusedCols(
      outVariables
    , variableCols)
  );

  const outVariationsCSV = Papa.unparse(
    removeUnusedCols(
      outVariations
    , variationCols)
  );

  const outVariationsAndVariablesCSV = Papa.unparse(
    removeUnusedCols(outVariationsAndVariablesArr, variationAndVariableCols)
  );

  // const outCSV = Papa.unparse(newData);
  // fs.writeFileSync('./listaout.csv', outCSV);

  fs.writeFileSync('./variations-out.csv', outVariationsCSV);
  fs.writeFileSync('./variables-out.csv', outVariablesCSV);
  fs.writeFileSync('./variables-and-variations-out.csv', outVariationsAndVariablesCSV);
  fs.writeFileSync('./remaining-out.csv', outRemainingCSV);
}

main();

