CSV converter for WooCommerce CSV Import Suite
-

Did the regular WooCommerce product import failed for your large CSV? Getting errors with your variable products?
"Used for variations" is not checked or the products end up being imported as simple products or simply the variations are not recognized?

You are not alone! Some of us are having exactly the same problems.

It seems that you have to [separate your CSV into multiple segments for it to work](https://docs.woocommerce.com/document/product-csv-importer-exporter/#section-7) but again, sometimes it doesn't, at least not for me.

I had slightly better luck with the CSV import Suite Plugin, but the columns are formatted differently and honestly it requires you to do stuff that WooCommerce should do automatically. Why should you fill out the variable product with all it's variations options in the `attribute:` column? I don't know, but at least this script does it for you.


Installation
--

`npm install`


Usage
--
Create a CSV with all your products, grouped, simple, variable and variations using the following columns, some of them are optional. Refer to [CSV Import Suite documentation](https://docs.woocommerce.com/document/product-csv-import-suite-column-header-reference/).
`
tax:product_type
post_type
menu_order
post_status
post_title
post_date
post_content
post_excerpt
post_parent
post_password
visibility
sku
upsell_skus
upsell_ids
crosssell_skus
crosssell_ids
featured
downloadable
virtual
regular_price
sale_price
manage_stock
stock
stock_status
backorders
weight
length
width
height
tax_status
tax_class
tax:product_shipping_class
sale_price_dates_from
sale_price_dates_to
images
product_url
button_text
meta:_sold_individually
meta:total_sales
tax:product_cat
tax:product_tag
parent_sku
Attribute 1 Name
Attribute 1 Value(s)
Attribute 1 Data
Attribute 1 Global
`

Add your attributes using the following columns in your CSV:
`
Attribute 1 Name
Attribute 1 Value(s)
Attribute 1 Data
Attribute 1 Global
`
The data column should have the same content that is used in the attribute_data:ATTRIBUTE_NAME column of the CSV Import Suite (position | visible | variation).
The global column should be either 0 or 1.

And the script will generate the following columns based on the attribute's name and global attribute. It will automatically fill the variable product's attribute values based on all the children of that product based on the parent's SKU. It will also automatically fill the attribute's default value selecting the cheapest variation.

attribute:ATTRIBUTE_NAME
attribute_data:ATTRIBUTE_NAME
attribute_default:ATTRIBUTE_NAME
meta:attribute_ATTRIBUTE_NAME

`node app.js ~/path/to/yourfile.csv`

The script will generate 4 files: 
`
variations-out.csv
variables-out.csv
variables-and-variations-out.csv
remaining-out.csv
`

Import the variables-out.csv first using the [CSV Import Suite](https://woocommerce.com/products/product-csv-import-suite/), then the variations-out.csv and at the end the remaining products.