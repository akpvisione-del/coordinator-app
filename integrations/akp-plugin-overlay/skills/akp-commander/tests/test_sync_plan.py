import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from sync_plan import plan,project
class SyncTests(unittest.TestCase):
 def setUp(self):
  self.base={'ID_AKP':'AKP-SYNTHETIC','KLIENT':'Synthetic','TYP_PRACY':'Test','STATUS':'DO_UMOWIENIA','PRIORYTET':'NORMALNY','ADRES':'Synthetic address','TELEFON':'','NETTO':'private-finance'}
  self.app={**project(self.base),'akp_id':'AKP-SYNTHETIC','updated_at':'2026-10-16T00:00:00Z'}
 def test_no_changes(self):
  p=plan(self.base,self.base,self.app);self.assertEqual(p['sheet_patch'],{});self.assertEqual(p['app_patch'],{})
 def test_drive_to_app(self):
  s={**self.base,'STATUS':'DO_ODBIORU'};p=plan(self.base,s,self.app);self.assertEqual(p['app_patch']['status'],'DO_ODBIORU');self.assertEqual(p['sheet_patch'],{})
 def test_app_to_drive(self):
  p=plan(self.base,self.base,{**self.app,'status':'UMOWIONE'});self.assertEqual(p['sheet_patch'],{'STATUS':'UMOWIONE'})
 def test_disjoint_changes(self):
  p=plan(self.base,{**self.base,'STATUS':'DO_ODBIORU'},{**self.app,'client_phone':'synthetic-phone'});self.assertEqual(p['sheet_patch'],{'TELEFON':'synthetic-phone'});self.assertEqual(p['app_patch']['status'],'DO_ODBIORU')
 def test_conflict_blocks_whole_record(self):
  p=plan(self.base,{**self.base,'STATUS':'DO_ODBIORU'},{**self.app,'status':'UMOWIONE','client_phone':'synthetic-phone'});self.assertFalse(p['ack_allowed']);self.assertEqual(p['sheet_patch'],{})
 def test_phone_roundtrip_converges(self):
  a={**self.app,'client_phone':'synthetic-phone'};p=plan(self.base,self.base,a);merged={**a,**p['app_patch']};q=plan(p['merged_source'],p['merged_source'],merged);self.assertEqual(q['sheet_patch'],{});self.assertEqual(q['app_patch'],{})
 def test_identity(self):
  with self.assertRaises(ValueError):plan(self.base,{**self.base,'ID_AKP':'other'},self.app)
 def test_address_alias(self):
  p=plan(self.base,self.base,{**self.app,'client_address':'new-address'});self.assertEqual(p['sheet_patch'],{'ADRES':'new-address'});self.assertEqual(p['app_patch']['location'],'new-address')
 def test_unknown_title_needs_review(self):
  p=plan(self.base,self.base,{**self.app,'title':'arbitrary edited title'});self.assertFalse(p['ack_allowed'])
 def test_financials_preserved(self):
  p=plan(self.base,self.base,{**self.app,'status':'UMOWIONE'});self.assertEqual(p['merged_source']['NETTO'],'private-finance');self.assertNotIn('NETTO',p['sheet_patch'])
 def test_archive_specific_status_preserved(self):
  b={**self.base,'STATUS':'WYKONANE_ROZLICZONE_DO_ARCHIWIZACJI'};a={**project(b),'akp_id':b['ID_AKP']};self.assertEqual(plan(b,b,a)['sheet_patch'],{})
if __name__=='__main__':unittest.main()
