import 'package:flutter/material.dart';
import 'package:mobile_receipt_scanner/presentation/widgets/layouts/app_bar.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppBarLayout(
        textColor: Colors.deepPurple,
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.all(16),
          child: Column(
            children: [
              Card(
                elevation: 2,
                shadowColor: Colors.black,
                child: Container(
                  padding: EdgeInsets.all(16),
                  width: double.infinity,
                  height: 148,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [ Color(0xFF7C3AED), Color(0xFFEC4899),],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text("Hello, Rizki!",style: TextStyle(color: Colors.white),),
                      Text("THIS MONTH'S TOTAL",style: TextStyle(color: Colors.white,fontSize: 16),),
                      Text("Rp. 4.250.000",style: TextStyle(color: Colors.white,fontSize: 24, fontWeight: FontWeight.bold),),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12,),
              Row(
                children: [
                  
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}
