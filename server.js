require('dotenv').config();
const express=require('express'), cors=require('cors'), path=require('path');
const axios=require('axios'), mysql=require('mysql2/promise'), crypto=require('crypto');
const app=express();
app.use(cors()); app.use(express.json()); app.use(express.urlencoded({extended:true}));

const PORT=Number(process.env.PORT||3000);
const BASE_URL=(process.env.BASE_URL||`http://localhost:${PORT}`).replace(/\/$/,'');
// Supports both generic DB_* variables and Aiven/managed-MySQL MYSQL* variables.
const DB_HOST=process.env.DB_HOST||process.env.MYSQLHOST||'localhost';
const DB_PORT=Number(process.env.DB_PORT||process.env.MYSQLPORT||3306);
const DB_USER=process.env.DB_USER||process.env.MYSQLUSER||'root';
const DB_PASSWORD=process.env.DB_PASSWORD||process.env.MYSQLPASSWORD||'';
const DB_NAME=process.env.DB_NAME||process.env.MYSQLDATABASE||'supershop';

const pool=mysql.createPool({
  host:DB_HOST, port:DB_PORT, user:DB_USER, password:DB_PASSWORD,
  database:DB_NAME, waitForConnections:true, connectionLimit:10
});
const sandbox=process.env.SSLCZ_MODE!=='live';
const SSL_BASE=sandbox?'https://sandbox.sslcommerz.com':'https://securepay.sslcommerz.com';
const INIT_URL=`${SSL_BASE}/gwprocess/v4/api.php`;
const VALIDATE_URL=`${SSL_BASE}/validator/api/validationserverAPI.php`;

function token(){return crypto.randomBytes(24).toString('hex')}
async function auth(req,res,next){
  const t=(req.headers.authorization||'').replace('Bearer ','');
  if(!t)return res.status(401).json({error:'Admin login required'});
  const [rows]=await pool.query(`SELECT * FROM admin_sessions WHERE token=? AND expires_at>NOW()`,[t]);
  if(!rows.length)return res.status(401).json({error:'Invalid or expired session'});
  req.admin=rows[0]; next();
}
function tran(){return `SS-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`}

app.use(express.static(path.join(__dirname,'..','frontend')));

app.get('/health',(req,res)=>res.json({ok:true,service:'SuperShop'}));


app.post('/api/admin/login',async(req,res)=>{
  try{
    const {email,password}=req.body;
    const [rows]=await pool.query(`SELECT * FROM admins WHERE email=? AND password_hash=SHA2(?,256) AND active=1`,[email,password]);
    if(!rows.length)return res.status(401).json({error:'Invalid email or password'});
    const t=token();
    await pool.query(`INSERT INTO admin_sessions(admin_id,token,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 12 HOUR))`,[rows[0].id,t]);
    res.json({token:t,admin:{id:rows[0].id,name:rows[0].name,email:rows[0].email}});
  }catch(e){console.error(e);res.status(500).json({error:'Login failed'})}
});
app.post('/api/admin/logout',auth,async(req,res)=>{
  await pool.query(`DELETE FROM admin_sessions WHERE token=?`,[(req.headers.authorization||'').replace('Bearer ','')]);
  res.json({ok:true});
});

app.get('/api/products',async(req,res)=>{
  try{const [rows]=await pool.query(`SELECT id,name,category,description,price,stock,image_url FROM products ORDER BY id DESC`);res.json(rows)}
  catch(e){res.status(500).json({error:'Could not load products'})}
});
app.get('/api/products/:id',async(req,res)=>{
  try{const [r]=await pool.query(`SELECT * FROM products WHERE id=?`,[req.params.id]); if(!r.length)return res.status(404).json({error:'Not found'});res.json(r[0])}
  catch(e){res.status(500).json({error:'Could not load product'})}
});

app.post('/api/admin/products',auth,async(req,res)=>{
  const {name,category,description='',price,stock=0,image_url=''}=req.body;
  if(!name||!category||Number(price)<0)return res.status(400).json({error:'Name, category and valid price required'});
  try{const [r]=await pool.query(`INSERT INTO products(name,category,description,price,stock,image_url) VALUES(?,?,?,?,?,?)`,
    [name,category,description,Number(price),Number(stock),image_url]);res.json({id:r.insertId})}
  catch(e){res.status(500).json({error:'Could not add product'})}
});
app.put('/api/admin/products/:id',auth,async(req,res)=>{
  const {name,category,description='',price,stock=0,image_url=''}=req.body;
  try{await pool.query(`UPDATE products SET name=?,category=?,description=?,price=?,stock=?,image_url=? WHERE id=?`,
    [name,category,description,Number(price),Number(stock),image_url,req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:'Could not update product'})}
});
app.delete('/api/admin/products/:id',auth,async(req,res)=>{
  try{await pool.query(`DELETE FROM products WHERE id=?`,[req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:'Could not delete product'})}
});

app.get('/api/admin/orders',auth,async(req,res)=>{
  try{const [rows]=await pool.query(`SELECT * FROM orders ORDER BY created_at DESC`);res.json(rows)}
  catch(e){res.status(500).json({error:'Could not load orders'})}
});
app.put('/api/admin/orders/:id',auth,async(req,res)=>{
  const allowed=['PROCESSING','PACKED','SHIPPED','DELIVERED','CANCELLED'];
  if(!allowed.includes(req.body.order_status))return res.status(400).json({error:'Invalid status'});
  try{await pool.query(`UPDATE orders SET order_status=? WHERE id=?`,[req.body.order_status,req.params.id]);res.json({ok:true})}
  catch(e){res.status(500).json({error:'Could not update order'})}
});
app.get('/api/admin/dashboard',auth,async(req,res)=>{
  try{
    const [[p]] = await pool.query(`SELECT COUNT(*) products FROM products`);
    const [[o]] = await pool.query(`SELECT COUNT(*) orders FROM orders`);
    const [[c]] = await pool.query(`SELECT COUNT(DISTINCT customer_email) customers FROM orders`);
    const [[s]] = await pool.query(`SELECT COALESCE(SUM(amount),0) sales FROM orders WHERE payment_status='PAID'`);
    res.json({products:p.products,orders:o.orders,customers:c.customers,sales:Number(s.sales)});
  }catch(e){res.status(500).json({error:'Dashboard error'})}
});

async function cartFrom(items){
  if(!Array.isArray(items)||!items.length)throw Error('Cart is empty');
  const ids=[...new Set(items.map(x=>Number(x.productId)).filter(Number.isInteger))];
  const [ps]=await pool.query(`SELECT id,name,price,stock FROM products WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);
  const m=new Map(ps.map(p=>[p.id,p])); let total=0,out=[];
  for(const x of items){
    const p=m.get(Number(x.productId)), q=Math.max(1,Math.floor(Number(x.quantity)||1));
    if(!p)throw Error('Product not found'); if(q>p.stock)throw Error(`${p.name} has insufficient stock`);
    total+=Number(p.price)*q; out.push({productId:p.id,name:p.name,quantity:q,price:Number(p.price)});
  }
  return {total:Number(total.toFixed(2)),items:out};
}
app.post('/api/orders',async(req,res)=>{
  const {customer,items,paymentMethod='SSLCOMMERZ'}=req.body;
  if(!customer?.name||!customer?.email||!customer?.phone||!customer?.address)return res.status(400).json({error:'Customer information required'});
  try{
    const c=await cartFrom(items), id=tran(), db=await pool.getConnection();
    try{
      await db.beginTransaction();
      const [r]=await db.query(`INSERT INTO orders(tran_id,customer_name,customer_email,customer_phone,address,amount,currency,payment_method) VALUES(?,?,?,?,?,?,?,?)`,
        [id,customer.name,customer.email,customer.phone,customer.address,c.total,'BDT',paymentMethod]);
      for(const x of c.items)await db.query(`INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES(?,?,?,?,?)`,
        [r.insertId,x.productId,x.name,x.quantity,x.price]);
      await db.commit();res.json({orderId:r.insertId,tranId:id,amount:c.total});
    }catch(e){await db.rollback();throw e}finally{db.release()}
  }catch(e){res.status(400).json({error:e.message})}
});
app.post('/api/payment/initiate',async(req,res)=>{
  try{
    const [[o]]=await pool.query(`SELECT * FROM orders WHERE id=?`,[req.body.orderId]);
    if(!o)return res.status(404).json({error:'Order not found'});
    const p=new URLSearchParams({
      store_id:process.env.SSLCZ_STORE_ID||'',store_passwd:process.env.SSLCZ_STORE_PASSWORD||'',
      total_amount:String(o.amount),currency:'BDT',tran_id:o.tran_id,
      success_url:`${BASE_URL}/api/payment/success`,fail_url:`${BASE_URL}/api/payment/fail`,
      cancel_url:`${BASE_URL}/api/payment/cancel`,ipn_url:`${BASE_URL}/api/payment/ipn`,
      cus_name:o.customer_name,cus_email:o.customer_email,cus_add1:o.address,cus_city:'Dhaka',
      cus_postcode:'1200',cus_country:'Bangladesh',cus_phone:o.customer_phone,
      shipping_method:'NO',product_name:'SuperShop Order',product_category:'General',product_profile:'general',value_a:String(o.id)
    });
    const r=await axios.post(INIT_URL,p.toString(),{headers:{'Content-Type':'application/x-www-form-urlencoded'},timeout:30000});
    if(r.data?.status!=='SUCCESS'||!r.data?.GatewayPageURL)return res.status(502).json({error:r.data?.failedreason||'SSLCOMMERZ initiation failed'});
    res.json({gatewayUrl:r.data.GatewayPageURL});
  }catch(e){console.error(e.response?.data||e);res.status(500).json({error:'Payment initiation failed'})}
});
async function validate(data){
  const u=`${VALIDATE_URL}?${new URLSearchParams({val_id:data.val_id,store_id:process.env.SSLCZ_STORE_ID||'',store_passwd:process.env.SSLCZ_STORE_PASSWORD||'',v:'1',format:'json'})}`;
  return (await axios.get(u,{timeout:30000})).data;
}
async function callback(req,res,type){
  const d=req.body||{}, tid=d.tran_id;if(!tid)return res.status(400).send('Missing tran_id');
  try{
    const [[o]]=await pool.query(`SELECT * FROM orders WHERE tran_id=?`,[tid]);if(!o)return res.status(404).send('Order not found');
    if(type==='success'){
      const v=await validate(d),ok=['VALID','VALIDATED'].includes(v.status)&&Number(v.amount)===Number(o.amount)&&String(v.currency).toUpperCase()==='BDT';
      await pool.query(`UPDATE orders SET payment_status=?,val_id=?,bank_tran_id=?,card_type=? WHERE tran_id=?`,
        [ok?'PAID':'INVALID',v.val_id||null,v.bank_tran_id||null,v.card_type||null,tid]);
      return res.redirect(ok?`/payment-success.html?tran_id=${encodeURIComponent(tid)}`:`/payment-failed.html?tran_id=${encodeURIComponent(tid)}`);
    }
    const status=type==='fail'?'FAILED':'CANCELLED';
    await pool.query(`UPDATE orders SET payment_status=? WHERE tran_id=?`,[status,tid]);
    res.redirect(`/${type==='fail'?'payment-failed':'payment-cancelled'}.html?tran_id=${encodeURIComponent(tid)}`);
  }catch(e){console.error(e.response?.data||e);res.status(500).send('Callback error')}
}
app.post('/api/payment/success',(q,s)=>callback(q,s,'success'));
app.post('/api/payment/fail',(q,s)=>callback(q,s,'fail'));
app.post('/api/payment/cancel',(q,s)=>callback(q,s,'cancel'));
app.post('/api/payment/ipn',async(req,res)=>{
  try{
    const d=req.body||{}; if(!d.tran_id||!d.val_id)return res.status(400).send('Invalid IPN');
    const [[o]]=await pool.query(`SELECT * FROM orders WHERE tran_id=?`,[d.tran_id]);if(!o)return res.status(404).send('Not found');
    const v=await validate(d),ok=['VALID','VALIDATED'].includes(v.status)&&Number(v.amount)===Number(o.amount)&&String(v.currency).toUpperCase()==='BDT';
    if(ok)await pool.query(`UPDATE orders SET payment_status='PAID',val_id=?,bank_tran_id=?,card_type=? WHERE tran_id=?`,[v.val_id,v.bank_tran_id||null,v.card_type||null,d.tran_id]);
    res.send('IPN received');
  }catch(e){res.status(500).send('IPN error')}
});
app.get('/api/orders/:tranId',async(req,res)=>{
  try{const [[o]]=await pool.query(`SELECT * FROM orders WHERE tran_id=?`,[req.params.tranId]);if(!o)return res.status(404).json({error:'Not found'});
    const [items]=await pool.query(`SELECT * FROM order_items WHERE order_id=?`,[o.id]);res.json({order:o,items})
  }catch(e){res.status(500).json({error:'Could not load order'})}
});
app.get('*splat',(req,res)=>res.sendFile(path.join(__dirname,'..','frontend','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`SuperShop: ${BASE_URL} | SSLCOMMERZ: ${sandbox?'SANDBOX':'LIVE'}`));
