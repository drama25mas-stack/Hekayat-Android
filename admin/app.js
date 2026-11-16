const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem("hekayat_admin_token") || "";
let stories = [], categories = [];
const api = async (path, options = {}) => {
  const headers = { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(options.headers || {}) };
  if (token) headers.authorization = "Bearer " + token;
  const response = await fetch("/v1" + path, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "تعذر تنفيذ الطلب");
  return data;
};
function showDashboard(on) { $("login").hidden = on; $("dashboard").hidden = !on; }
function error(message) { $("globalError").textContent = message || ""; }
async function loadAll() {
  error("");
  const [s,c,stats] = await Promise.all([api("/admin/stories"),api("/admin/categories"),api("/admin/stats")]);
  stories=s; categories=c;
  $("statStories").textContent=stats.stories; $("statPublished").textContent=stats.published;
  $("statDrafts").textContent=stats.drafts; $("statViews").textContent=stats.views;
  renderStories(); renderCategories(); fillCategorySelect();
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("loginError").textContent="";
  try {
    const r=await fetch("/v1/admin/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:$("email").value,password:$("password").value})});
    const data=await r.json(); if(!r.ok) throw new Error(data.error || "فشل تسجيل الدخول");
    token=data.token; sessionStorage.setItem("hekayat_admin_token",token); showDashboard(true); await loadAll();
  } catch(err){$("loginError").textContent=err.message;}
});
$("logout").onclick=()=>{token="";sessionStorage.removeItem("hekayat_admin_token");showDashboard(false);};
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));
  document.querySelectorAll(".view").forEach(x=>x.hidden=x.id!==b.dataset.tab);
});
function fillCategorySelect(){ $("storyCategory").innerHTML='<option value="">بدون تصنيف</option>'+categories.map(c=>'<option value="'+c.id+'">'+escapeHtml(c.name)+'</option>').join("");}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderStories(){
  $("storyList").innerHTML=stories.length?stories.map(s=>'<div class="list-row"><div><div class="row-title">'+escapeHtml(s.title)+'</div><div class="row-meta">'+(s.status==="published"?"منشورة":"مسودة")+' · '+new Date(s.created_at).toLocaleDateString("ar-EG")+'</div></div><div class="row-actions"><button data-edit="'+s.id+'">تعديل</button><button class="danger" data-delete="'+s.id+'">حذف</button></div></div>').join(""):'<p class="muted">لا توجد قصص حتى الآن.</p>';
  $("storyList").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editStory(b.dataset.edit));
  $("storyList").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteStory(b.dataset.delete));
}
function renderCategories(){
  $("categoryList").innerHTML=categories.length?categories.map(c=>'<div class="list-row"><div class="row-title">'+escapeHtml(c.name)+'</div><div class="row-actions"><button class="danger" data-cat-delete="'+c.id+'">حذف</button></div></div>').join(""):'<p class="muted">لا توجد تصنيفات.</p>';
  $("categoryList").querySelectorAll("[data-cat-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("حذف التصنيف؟"))return;try{await api("/admin/categories/"+b.dataset.catDelete,{method:"DELETE"});await loadAll();}catch(e){error(e.message);}});
}
function editStory(id){
  const s=stories.find(x=>x.id===id); if(!s)return;
  $("storyId").value=s.id;$("storyTitle").value=s.title;$("storyDescription").value=s.description||"";
  $("storyCategory").value=s.category_id||"";$("storyStatus").value=s.status;$("storyVideo").value="";
  $("storyFormWrap").hidden=false;$("uploadStatus").textContent="اترك اختيار الفيديو فارغًا للاحتفاظ بالفيديو الحالي.";
}
$("newStory").onclick=()=>{$("storyForm").reset();$("storyId").value="";$("storyFormWrap").hidden=false;$("uploadStatus").textContent="اختر ملف فيديو لرفعه."};
$("cancelStory").onclick=()=>$("storyFormWrap").hidden=true;
async function upload(file){
  const init=await api("/admin/uploads",{method:"POST",body:JSON.stringify({filename:file.name})});
  const r=await fetch(init.upload_url,{method:"PUT",headers:{"authorization":"Bearer "+token,"content-type":file.type||"application/octet-stream","content-length":String(file.size)},body:file});
  const d=await r.json();if(!r.ok)throw new Error(d.error||"فشل رفع الفيديو");return d.object_key;
}
$("storyForm").addEventListener("submit",async e=>{
  e.preventDefault();error("");const id=$("storyId").value,file=$("storyVideo").files[0];
  try{
    let existing=id?stories.find(x=>x.id===id):null,key=existing?.video_object_key;
    if(file){$("uploadStatus").textContent="جارٍ رفع الفيديو…";key=await upload(file);}
    if(!key)throw new Error("اختار ملف فيديو أولًا");
    const body={title:$("storyTitle").value,description:$("storyDescription").value,category_id:$("storyCategory").value||null,status:$("storyStatus").value,video_object_key:key,file_size_bytes:file?.size||existing?.file_size_bytes,mime_type:file?.type||existing?.mime_type};
    if(id)await api("/admin/stories/"+id,{method:"PATCH",body:JSON.stringify(body)});
    else await api("/admin/stories",{method:"POST",body:JSON.stringify(body)});
    $("storyFormWrap").hidden=true;await loadAll();
  }catch(err){error(err.message);$("uploadStatus").textContent=err.message;}
});
async function deleteStory(id){if(!confirm("هل أنت متأكد من حذف القصة والفيديو؟"))return;try{await api("/admin/stories/"+id,{method:"DELETE"});await loadAll();}catch(e){error(e.message);}}
$("categoryForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/admin/categories",{method:"POST",body:JSON.stringify({name:$("categoryName").value})});$("categoryName").value="";await loadAll();}catch(err){error(err.message);}});
if(token){showDashboard(true);loadAll().catch(e=>{token="";sessionStorage.removeItem("hekayat_admin_token");showDashboard(false);$("loginError").textContent=e.message;});}
