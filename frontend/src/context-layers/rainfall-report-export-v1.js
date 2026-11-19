// Export the exact already-grouped rainfall report model, not a fresh query.
// Keep the displayed group/row order, measurements and gauge names.
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
})[ch]);

export function rainfallReportExportHtml(groups){
 const sections=(groups??[]).filter(group=>group.rows?.length).map(group=>
  "<p><strong>"+escapeHtml(group.title)+"</strong></p>\n<ul>\n"+
  group.rows.map(row=>"<li>"+escapeHtml(row.mm.toFixed(1)+" mm - "+row.name)+"</li>").join("\n")+
  "\n</ul>").join("\n");
 return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Q-Scope rainfall report</title></head><body>\n'+
  sections+"\n</body></html>\n";
}
