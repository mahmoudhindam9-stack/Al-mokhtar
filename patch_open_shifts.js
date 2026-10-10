const fs = require("fs");
const content = fs.readFileSync("src/routes/admin/mall.tsx", "utf-8");

const targetStr = `                  )}

                </CardContent>`;

const openShiftsBlock = `                  )}

                  {/* OPEN SHIFTS TABLE */}
                  {parkReportType === "open_shifts" && (
                    <div className="space-y-4">
                      {(state.parkShifts || [])
                        .filter((s: any) => s.status === "open")
                        .map((s: any) => {
                           const shiftTxs = (state.parkTicketTransactions || []).filter((tx: any) => tx.shift_id === s.id);
                           const shiftTotalUsd = shiftTxs.filter((tx: any) => tx.currency === 'USD' && tx.status !== 'refunded').reduce((acc: number, tx: any) => acc + tx.total_paid_in_currency, 0);
                           
                           return (
                             <div key={s.id} className="bg-card border border-border p-4 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                               <div>
                                 <div className="flex items-center gap-2 mb-2">
                                   <h3 className="font-black text-base">{s.shift_number}</h3>
                                   <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/30">وردية مفتوحة</Badge>
                                 </div>
                                 <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground">
                                   <span className="flex items-center gap-1"><span className="bg-muted px-2 py-0.5 rounded-md font-mono text-[10px]">رقم النظام: {s.auto_shift_number}</span></span>
                                   <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300"><User size={14}/> الكاشير: {s.cashier_name}</span>
                                   <span className="flex items-center gap-1"><Clock size={14}/> بدأت: {new Date(s.start_at).toLocaleTimeString('ar-EG')}</span>
                                   <span className="flex items-center gap-1 text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100"><ShoppingCart size={14}/> {shiftTxs.length} مبيعات (${shiftTotalUsd})</span>
                                 </div>
                               </div>
                               <div className="flex items-center gap-2 flex-wrap">
                                 <Button 
                                    variant="outline" 
                                    className="rounded-xl font-bold cursor-pointer h-9 px-4 text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200"
                                    onClick={() => {
                                      const newName = prompt("تعديل اسم أمين الصندوق:", s.cashier_name);
                                      if (newName && newName.trim()) {
                                        erpStore.updateParkShift(s.id, { cashier_name: newName });
                                        toast.success("تم التعديل بنجاح");
                                      }
                                    }}
                                 >
                                    <Edit size={14} className="ml-1" /> تعديل
                                 </Button>
                                 
                                 <Button 
                                    variant="default"
                                    className="rounded-xl font-bold cursor-pointer h-9 px-4 bg-teal-600 hover:bg-teal-700 text-white"
                                    onClick={() => {
                                       try {
                                         erpStore.resumeParkShift(s.id);
                                         setIsParkPosOpen(true);
                                       } catch (e: any) {
                                         toast.error(e.message);
                                       }
                                    }}
                                 >
                                    <ArrowRight size={14} className="ml-1" /> دخول الوردية (بيع / مرتجع)
                                 </Button>
                                 
                                 <Button 
                                    variant="outline" 
                                    className="rounded-xl font-bold cursor-pointer h-9 px-4 text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200"
                                    onClick={() => {
                                       setShiftToCloseFromLauncher(s);
                                       setIsParkShiftCloseModalOpen(true);
                                    }}
                                 >
                                    <Lock size={14} className="ml-1" /> إغلاق
                                 </Button>
                                 
                                 <Button 
                                    variant="outline" 
                                    size="icon"
                                    className="rounded-xl font-bold cursor-pointer h-9 w-9 text-rose-600 border-rose-200 hover:bg-rose-100 hover:text-rose-700"
                                    onClick={() => {
                                      if(window.confirm("هل أنت متأكد من حذف الوردية بالكامل وإلغاء جميع معاملاتها المعلقة؟ هذا الإجراء لا يمكن التراجع عنه!")) {
                                        erpStore.deleteParkShift(s.id);
                                        toast.success("تم الحذف بنجاح");
                                      }
                                    }}
                                 >
                                    <Trash2 size={15} />
                                 </Button>
                               </div>
                             </div>
                           );
                        })}
                        
                        {(state.parkShifts || []).filter((s: any) => s.status === "open").length === 0 && (
                           <div className="text-center py-10 text-muted-foreground font-bold">لا توجد أي ورديات مفتوحة حالياً</div>
                        )}
                    </div>
                  )}

                </CardContent>`;

const newContent = content.replace(targetStr, openShiftsBlock);
fs.writeFileSync("src/routes/admin/mall.tsx", newContent);
console.log("Patched");
